import { useState, useMemo, useEffect, ChangeEvent } from "react";
import { 
  Plus, 
  Download, 
  Trash2, 
  Edit2, 
  Calendar as CalendarIcon, 
  Clock, 
  User, 
  Users, 
  ClipboardList, 
  TrendingUp, 
  TrendingDown, 
  FileText,
  Sparkles,
  Loader2,
  Upload,
  History,
  Image as ImageIcon,
  LogIn,
  LogOut,
  Mail,
  Lock,
  ChevronRight
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { Toaster, toast } from "sonner";
import { User as SupabaseUser } from "@supabase/supabase-js";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import { Activity, WEEK_DAYS, DayName } from "./types";
import { supabase } from "@/lib/supabase";

const INITIAL_ACTIVITIES: Activity[] = [
  {
    id: "1",
    dia: "Miércoles",
    fecha: "2026-06-17",
    tiempo: "08:30",
    descripcion: "FERIA DEL EMPRENDIMIENTO - CONFERENCIA SINTEX",
    responsable: "Comité Organizador",
    equipo: "Estudiantes 5to Semestre",
    requisito: "Proyector, Audio, Stand",
    ingreso: 0,
    gastos: 0,
    resultado: "En Planificación",
  },
  {
    id: "2",
    dia: "Jueves",
    fecha: "2026-06-18",
    tiempo: "10:00",
    descripcion: "Exposición del Ing. Marcos Torrez",
    responsable: "Ing. Vanesa Delgado",
    equipo: "Auxiliares de Cátedra",
    requisito: "Sala de Conferencias",
    ingreso: 0,
    gastos: 0,
    resultado: "Confirmado",
  },
  {
    id: "3",
    dia: "Viernes",
    fecha: "2026-06-19",
    tiempo: "10:00",
    descripcion: "Clausura de Congreso",
    responsable: "Ing. Vanesa Delgado",
    equipo: "Protocolo",
    requisito: "Salón Auditorio",
    ingreso: 0,
    gastos: 0,
    resultado: "Programado",
  },
  {
    id: "4",
    dia: "Viernes",
    fecha: "2026-06-19",
    tiempo: "19:00",
    descripcion: "Inicio de Fiesta de Gala",
    responsable: "Centro de Estudiantes",
    equipo: "Comisión Social",
    requisito: "Local, Sonido, Cena",
    ingreso: 0,
    gastos: 0,
    resultado: "Venta de Entradas",
  }
];

export default function App() {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [selectedTab, setSelectedTab] = useState<string>("Lunes");

  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [isFilesDialogOpen, setIsFilesDialogOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [storedFiles, setStoredFiles] = useState<any[]>([]);

  // Form state
  const [formData, setFormData] = useState<Partial<Activity>>({});

  // 1. Gestión de Sesión y Autenticación
  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (mounted) {
        setUser(session?.user ?? null);
        setIsAuthChecking(false);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Auth Event:", event);
      if (mounted) {
        setUser(session?.user ?? null);
        setIsAuthChecking(false);
        
        // Si el usuario acaba de iniciar sesión, forzamos recarga de datos
        if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
          fetchActivities();
          fetchStoredFiles();
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // 2. Sincronización en Tiempo Real de Datos
  useEffect(() => {
    if (!user) return;

    // Limpieza de caché forzada al cargar para evitar datos obsoletos
    localStorage.removeItem("civil-plan-actividades");
    
    fetchActivities();
    fetchStoredFiles();

    const channel = supabase
      .channel('actividades_db_changes')
      .on('postgres_changes', { 
        event: '*', 
        table: 'actividades', 
        schema: 'public' 
      }, (payload) => {
        console.log('Cambio detectado en Supabase:', payload);
        fetchActivities();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Sesión cerrada");
  };

  const handleAuth = async (e: any) => {
    e.preventDefault();
    setIsAuthLoading(true);
    try {
      if (authMode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
        });
        if (error) throw error;
        toast.success("Registro exitoso. Revisa tu correo (si aplica) o inicia sesión.");
        setAuthMode("login");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword,
        });
        if (error) throw error;
        toast.success("¡Bienvenido de nuevo!");
      }
    } catch (error: any) {
      toast.error(error.message || "Error en la autenticación");
    } finally {
      setIsAuthLoading(false);
    }
  };

  const fetchStoredFiles = async () => {
    try {
      const { data, error } = await supabase.storage
        .from('archivos_ingenieria')
        .list('', {
          limit: 100,
          offset: 0,
          sortBy: { column: 'name', order: 'desc' },
        });

      if (error) throw error;
      setStoredFiles(data || []);
    } catch (error) {
      console.error("Error fetching files:", error);
    }
  };

  const getFileUrl = (fileName: string) => {
    const { data } = supabase.storage
      .from('archivos_ingenieria')
      .getPublicUrl(fileName);
    return data.publicUrl;
  };

  const eliminarArchivo = async (name: string) => {
    alert('Iniciando borrado de: ' + name);
    const { error } = await supabase.storage
      .from('archivos_ingenieria')
      .remove([name]);

    if (error) {
      alert('Error: ' + error.message);
    } else {
      alert('Borrado exitoso');
      await fetchStoredFiles();
    }
  };

  const fetchActivities = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('actividades')
        .select('*')
        .order('tiempo', { ascending: true });

      if (error) throw error;
      
      const activitiesToSet = data || [];
      setActivities(activitiesToSet);
      localStorage.setItem("civil-plan-actividades", JSON.stringify(activitiesToSet));
      
    } catch (error) {
      console.error("Error loading activities:", error);
      toast.error("Error al conectar con Supabase. Mostrando datos locales.");
      const saved = localStorage.getItem("civil-plan-actividades");
      if (saved) {
        setActivities(JSON.parse(saved));
      } else {
        setActivities([]); // Default to empty if everything fails
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
      const filePath = `actividades/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('archivos_ingenieria')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('archivos_ingenieria')
        .getPublicUrl(filePath);

      setFormData(prev => ({ ...prev, fichero_url: publicUrl }));
      toast.success("Archivo subido correctamente");
    } catch (error: any) {
      console.error('Error uploading file:', error);
      toast.error(`Error al subir archivo: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.descripcion) {
      toast.error("Por favor completa los campos obligatorios (Actividad y Hora)");
      return;
    }

    const currentDay = WEEK_DAYS.find(d => d.nombre === selectedTab);
    
    // Generar ID con fallback si crypto.randomUUID no está disponible
    const activityId = editingActivity?.id || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9));
    
    // Generar registro de historial si se está editando
    let nuevoHistorial = formData.historial_cambios || "";
    if (editingActivity) {
      const timestamp = format(new Date(), "dd/MM/yyyy HH:mm");
      
      // Construir mensaje detallado de lo que cambió
      let cambios = [];
      if (formData.descripcion !== editingActivity.descripcion) cambios.push("Actividad");
      if (formData.tiempo !== editingActivity.tiempo) cambios.push("Horario");
      if (formData.ingreso !== editingActivity.ingreso) cambios.push("Ingresos");
      if (formData.gastos !== editingActivity.gastos) cambios.push("Gastos");
      
      const detalle = cambios.length > 0 ? ` (Cambios en: ${cambios.join(", ")})` : "";
      const logEntry = `[${timestamp}] - Actividad editada${detalle}`;
      
      // Acumulación limpia: evitamos duplicados o saltos de línea excesivos
      const historialLimpio = nuevoHistorial.trim();
      nuevoHistorial = historialLimpio ? `${historialLimpio}\n${logEntry}` : logEntry;
    }

    // Construcción del payload sanitizado
    // Usamos Number() de forma explícita para asegurar que los valores sean numéricos
    const payload: any = {
      dia: selectedTab as DayName,
      fecha: currentDay?.fecha || null,
      tiempo: formData.tiempo || null,
      fin_de_hora: formData.fin_de_hora || null,
      descripcion: formData.descripcion || null,
      responsable: formData.responsable || null,
      equipo: formData.equipo || null,
      requisito: formData.requisito || null,
      ingreso: isNaN(Number(formData.ingreso)) ? 0 : Number(formData.ingreso),
      gastos: isNaN(Number(formData.gastos)) ? 0 : Number(formData.gastos),
      resultado: formData.resultado || null,
      numero_estudiantes: isNaN(Number(formData.numero_estudiantes)) ? 0 : Number(formData.numero_estudiantes),
      fichero_url: formData.fichero_url || null,
      historial_cambios: nuevoHistorial || null,
      usuario_email: user?.email || null
    };

    try {
      setIsLoading(true);
      let result;
      
      if (editingActivity) {
        // ACTUALIZACIÓN: Usamos .update() filtrando por ID exacto
        // No incluimos el ID en el payload del update para evitar problemas de restricción de llave primaria
        result = await supabase
          .from("actividades")
          .update(payload)
          .eq("id", editingActivity.id)
          .select();
      } else {
        // INSERCIÓN: Incluimos el ID generado
        result = await supabase
          .from("actividades")
          .insert({ ...payload, id: activityId })
          .select();
      }

      const { error } = result;

      if (error) {
        console.error("Error de Supabase:", error);
        throw error;
      }

      // Sincronización Forzada: Volvemos a pedir los datos a Supabase para asegurar que la UI refleje la realidad del servidor
      await fetchActivities();

      toast.success(editingActivity ? "✓ Sincronizado: Actividad actualizada" : "✓ Sincronizado: Actividad añadida");

      setIsDialogOpen(false);
      setEditingActivity(null);
      setFormData({});
    } catch (error: any) {
      console.error("Error en handleSave:", error);
      const errorMsg = error.message || error.details || "Error de red o permisos";
      toast.error(`Fallo de Sincronización: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (activity: Activity) => {
    setEditingActivity(activity);
    setFormData(activity);
    setSelectedTab(activity.dia);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('actividades')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Actualización Optimista: Removemos de la lista local inmediatamente
      setActivities(prev => prev.filter(a => a.id !== id));
      
      await fetchActivities();
      toast.info("Actividad eliminada");
    } catch (error) {
      console.error("Error deleting from Supabase:", error);
      toast.error("Error al eliminar en Supabase");
    }
  };

  const exportToExcel = () => {
    const sortedData = [...activities].sort((a, b) => {
      const dayIdxA = WEEK_DAYS.findIndex(d => d.nombre === a.dia);
      const dayIdxB = WEEK_DAYS.findIndex(d => d.nombre === b.dia);
      if (dayIdxA !== dayIdxB) return dayIdxA - dayIdxB;
      return a.tiempo.localeCompare(b.tiempo);
    });

    const worksheetData = sortedData.map(a => ({
      "Día": a.dia,
      "Fecha": a.fecha,
      "Inicio": a.tiempo,
      "Fin": a.fin_de_hora || "-",
      "Actividad": a.descripcion,
      "Responsable": a.responsable,
      "Equipo de Trabajo": a.equipo,
      "Requerimiento": a.requisito,
      "Ingreso (Bs)": a.ingreso,
      "Egreso (Bs)": a.gastos,
      "Resultado": a.resultado
    }));

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Planificación Semana");
    
    const range = XLSX.utils.decode_range(worksheet['!ref'] || "");
    const wscols = [];
    if (range.e.c >= 0) {
      for (let C = range.s.c; C <= range.e.c; ++C) wscols.push({ wch: 20 });
    }
    worksheet['!cols'] = wscols;

    XLSX.writeFile(workbook, `Planificacion_Semana_Civil_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    toast.success("Excel exportado exitosamente");
  };

  const filteredActivities = useMemo(() => {
    return activities
      .filter(a => a.dia === selectedTab)
      .sort((a, b) => a.tiempo.localeCompare(b.tiempo));
  }, [activities, selectedTab]);

  const financialStats = useMemo(() => {
    const totalIngreso = activities.reduce((acc, act) => {
      const val = act.ingreso;
      const num = typeof val === 'number' ? val : parseFloat(String(val));
      return acc + (isNaN(num) ? 0 : num);
    }, 0);
    
    const totalGastos = activities.reduce((acc, act) => {
      const val = act.gastos;
      const num = typeof val === 'number' ? val : parseFloat(String(val));
      return acc + (isNaN(num) ? 0 : num);
    }, 0);
    
    const balance = totalIngreso - totalGastos;
    
    const totalEstudiantes = activities.reduce((acc, act) => {
      const val = act.numero_estudiantes;
      const num = typeof val === 'number' ? val : parseInt(String(val));
      return acc + (isNaN(num) ? 0 : num);
    }, 0);
    
    return { totalIngreso, totalGastos, balance, totalEstudiantes };
  }, [activities]);

  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center gap-4">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-400 rounded-2xl shadow-2xl shadow-yellow-400/20 mb-2">
          <CalendarIcon className="w-8 h-8 text-black animate-pulse" />
        </div>
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 text-yellow-400 animate-spin" />
          <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em]">Validando Sesión...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white font-sans flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-400 rounded-2xl shadow-2xl shadow-yellow-400/20 mb-4">
              <CalendarIcon className="w-8 h-8 text-black" />
            </div>
            <h1 className="text-3xl font-black tracking-tighter mb-2">CIVIL PLAN</h1>
            <p className="text-gray-500 text-xs font-black uppercase tracking-[0.2em]">Semana de Ingeniería Académica</p>
          </div>

          <Card className="bg-[#141414] border-white/5 shadow-2xl">
            <CardHeader className="text-center">
              <CardTitle className="text-xl font-black text-white uppercase tracking-widest">
                {authMode === "login" ? "Iniciar Sesión" : "Crear Cuenta"}
              </CardTitle>
              <CardDescription className="text-[10px] font-bold text-gray-500 uppercase">
                {authMode === "login" 
                  ? "Accede al sistema de planificación" 
                  : "Regístrate para gestionar eventos"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAuth} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Correo Electrónico</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                    <Input 
                      type="email" 
                      placeholder="nombre@uagrm.edu" 
                      className="bg-black/50 border-white/10 h-10 pl-10 focus:border-yellow-400 transition-all text-white"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Contraseña</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                    <Input 
                      type="password" 
                      placeholder="••••••••" 
                      className="bg-black/50 border-white/10 h-10 pl-10 focus:border-yellow-400 transition-all text-white"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <Button 
                  type="submit" 
                  className="w-full h-11 bg-yellow-400 hover:bg-yellow-300 text-black font-black uppercase tracking-widest text-xs rounded-xl shadow-lg shadow-yellow-400/10 group"
                  disabled={isAuthLoading}
                >
                  {isAuthLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      {authMode === "login" ? "Entrar ahora" : "Registrarme"}
                      <ChevronRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
            <Separator className="bg-white/5" />
            <div className="p-6 text-center">
              <button 
                onClick={() => setAuthMode(authMode === "login" ? "signup" : "login")}
                className="text-[10px] font-black text-gray-500 uppercase tracking-widest hover:text-yellow-400 transition-colors"
              >
                {authMode === "login" 
                  ? "¿No tienes cuenta? Registrate aquí" 
                  : "¿Ya tienes cuenta? Inicia sesión"}
              </button>
            </div>
          </Card>
        </motion.div>
        <Toaster position="bottom-right" richColors closeButton />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white font-sans selection:bg-yellow-400 selection:text-black p-2 md:p-8">
      {isLoading && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-12 h-12 text-yellow-400 animate-spin" />
          <span className="text-yellow-400 font-black tracking-widest uppercase text-xs">Sincronizando con Supabase...</span>
        </div>
      )}
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Navigation Bar */}
        <div className="flex items-center justify-between bg-[#141414] px-8 py-4 rounded-3xl border border-white/5 shadow-2xl backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-400 rounded-xl flex items-center justify-center shadow-lg shadow-yellow-400/20">
              <CalendarIcon className="w-5 h-5 text-black" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-black tracking-tighter leading-none text-white">CIVIL<span className="text-yellow-400">PLAN</span></span>
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">UAGRM • Ingeniería</span>
            </div>
          </div>
            <div className="flex gap-4 items-center">
              <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full border border-white/10">
                 <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                 <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Sincronización Activa</span>
              </div>
              <Button 
                variant="ghost" 
                onClick={handleLogout}
                className="rounded-full text-white hover:bg-rose-500/10 flex gap-2 font-black text-[10px] uppercase tracking-widest text-rose-400"
              >
                <LogOut className="w-3.5 h-3.5" />
                Salir
              </Button>
              <Button variant="ghost" onClick={exportToExcel} className="rounded-full text-white hover:bg-white/10 flex gap-2 font-bold text-xs uppercase tracking-widest">
                <Download className="w-4 h-4" />
                Exportar
              </Button>
            </div>
        </div>

        {/* Hero Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center bg-[#141414] p-10 rounded-[3rem] border border-white/5 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-96 h-96 bg-yellow-400/10 rounded-full blur-[120px] -mr-48 -mt-48 opacity-50" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[100px] -ml-32 -mb-32 opacity-30" />
          
          <div className="space-y-6 relative z-10">
            <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-full mb-2">
              <TrendingUp className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Plataforma de Alta Gestión</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-white leading-[0.9]">
              Maestría en <span className="text-yellow-400">Planificación</span>
            </h1>
            <p className="text-gray-400 text-lg max-w-md font-medium leading-relaxed opacity-80">
              Control total de la agenda académica, logística y presupuesto para el Centro de Estudiantes de Civil.
            </p>
            <div className="pt-4 max-w-md grid grid-cols-2 gap-4">
              <div 
                className="group/upload border-2 border-dashed border-white/10 rounded-[2rem] p-6 flex flex-col items-center justify-center gap-3 bg-white/[0.02] hover:bg-white/[0.05] hover:border-yellow-400/50 transition-all cursor-pointer relative overflow-hidden h-40"
                onClick={() => document.getElementById('poster-upload')?.click()}
              >
                <input 
                  type="file" 
                  id="poster-upload" 
                  className="hidden" 
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setIsUploading(true);
                      try {
                        const fileExt = file.name.split('.').pop();
                        const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
                        const { error } = await supabase.storage
                          .from('archivos_ingenieria')
                          .upload(fileName, file);
                        if (error) throw error;
                        fetchStoredFiles();
                        toast.success(`Archivo "${file.name}" subido exitosamente`);
                      } catch (err: any) {
                        toast.error("Error al subir: " + err.message);
                      } finally {
                        setIsUploading(false);
                      }
                    }
                  }}
                />
                <div className="w-12 h-12 bg-yellow-400/10 rounded-xl flex items-center justify-center group-hover/upload:scale-110 transition-transform">
                   {isUploading ? <Loader2 className="w-6 h-6 text-yellow-400 animate-spin" /> : <Upload className="w-6 h-6 text-yellow-400" />}
                </div>
                <div className="text-center">
                  <span className="text-xs font-black text-white block uppercase tracking-widest">Subir</span>
                  <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mt-1">Nuevos Archivos</span>
                </div>
              </div>

              <div 
                onClick={() => setIsFilesDialogOpen(true)}
                className="group/view border border-white/10 rounded-[2rem] p-6 flex flex-col items-center justify-center gap-3 bg-white/5 hover:bg-white/10 hover:border-emerald-500/50 transition-all cursor-pointer h-40"
              >
                <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center group-hover/view:scale-110 transition-transform">
                  <ImageIcon className="w-6 h-6 text-emerald-500" />
                </div>
                <div className="text-center">
                  <span className="text-xs font-black text-white block uppercase tracking-widest">Visualizar</span>
                  <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mt-1">Biblioteca Digital</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 h-fit">
            <Card className="rounded-[2.5rem] border border-white/5 bg-[#1A1A1A] text-white p-8 space-y-2 group transition-all hover:border-yellow-400/30">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Actividades Totales</span>
              <div className="text-6xl font-black tracking-tighter text-yellow-400">{activities.length}</div>
            </Card>
            <Card className="rounded-[2.5rem] border border-white/5 bg-[#1A1A1A] text-white p-8 space-y-2 group transition-all hover:border-emerald-500/30">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Estudiantes</span>
              <div className="text-5xl font-black tracking-tighter text-emerald-500">
                {financialStats.totalEstudiantes}
              </div>
            </Card>
            <Card className="rounded-[2.5rem] border border-white/5 bg-[#1A1A1A] text-white p-8 space-y-2 group transition-all hover:border-white/20 col-span-2">
               <div className="flex justify-between items-end">
                 <div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Balance Financiero</span>
                    <div className="text-4xl font-black tracking-tighter mt-1">
                      {financialStats.balance}<span className="text-sm ml-1 text-gray-600">Bs</span>
                    </div>
                 </div>
                 <div className="flex gap-4">
                    <div className="text-right">
                      <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest block">Ingresos</span>
                      <span className="font-bold text-emerald-500">+{financialStats.totalIngreso}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest block">Gastos</span>
                      <span className="font-bold text-rose-500">-{financialStats.totalGastos}</span>
                    </div>
                 </div>
               </div>
            </Card>
          </div>
        </div>


        {/* Schedule Table */}
        <div className="space-y-8 pb-20">
          <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
            <div className="flex items-center justify-between px-2 mb-8">
              <div className="flex items-center gap-6">
                <div className="flex flex-col">
                  <h2 className="text-3xl font-black tracking-tighter text-white uppercase italic-small">Agenda Académica</h2>
                  <div className="text-sm text-gray-500 font-medium mt-1 uppercase tracking-widest flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Sincronización en Tiempo Real
                  </div>
                </div>
                
                <Dialog open={isDialogOpen} onOpenChange={(open) => {
                  setIsDialogOpen(open);
                  if (!open) { setEditingActivity(null); setFormData({}); }
                }}>
                  <DialogTrigger 
                    render={
                      <button className="rounded-2xl bg-white/5 border border-white/10 hover:border-yellow-400/50 text-white flex items-center gap-2 h-12 px-5 transition-all hover:bg-white/10 font-black text-xs uppercase tracking-widest cursor-pointer">
                        <Plus className="w-4 h-4 text-yellow-400" />
                        Añadir Actividad
                      </button>
                    } 
                  />
                  <DialogContent className="sm:max-w-4xl rounded-[2.5rem] bg-[#1A1A1A] p-0 overflow-hidden border border-white/10 shadow-3xl text-white">
                    <div className="flex flex-col md:flex-row h-full">
                      {/* Left Panel: Context */}
                      <div className="w-full md:w-1/3 bg-black/40 p-10 flex flex-col justify-between border-b md:border-b-0 md:border-r border-white/5">
                        <div className="space-y-6">
                          <div className="w-12 h-12 bg-yellow-400 rounded-2xl flex items-center justify-center">
                            <ClipboardList className="w-6 h-6 text-black" />
                          </div>
                          <div>
                            <DialogTitle className="text-3xl font-black tracking-tighter text-white">
                              {editingActivity ? "Editar Registro" : "Nuevo Registro"}
                            </DialogTitle>
                            <DialogDescription className="text-gray-500 text-sm mt-2 leading-relaxed">
                              Completa los detalles de la actividad académica. La precisión es clave para el éxito logístico.
                            </DialogDescription>
                          </div>
                        </div>
                        
                        <div className="space-y-4 pt-8">
                          <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">Día de Gestión</span>
                            <span className="text-lg font-black text-yellow-400">{selectedTab}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right Panel: Fields */}
                      <div className="w-full md:w-2/3 p-10 flex flex-col">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 overflow-y-auto max-h-[60vh] pr-2 scrollbar-hide">
                          <div className="col-span-2 space-y-2">
                            <Label className="text-[10px] uppercase tracking-widest font-black text-gray-500">Actividad Académica</Label>
                            <Input 
                              placeholder="Nombre de la actividad..."
                              className="h-14 bg-white/5 border-white/10 rounded-2xl focus:bg-white/10 focus:ring-yellow-400 text-white font-bold"
                              value={formData.descripcion || ""}
                              onChange={(e) => setFormData({...formData, descripcion: e.target.value})}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="text-[10px] uppercase tracking-widest font-black text-gray-500">Hora de Inicio</Label>
                            <Input 
                              type="time" 
                              className="h-14 bg-white/5 border-white/10 rounded-2xl focus:ring-yellow-400 text-white font-bold"
                              value={formData.tiempo || ""}
                              onChange={(e) => setFormData({...formData, tiempo: e.target.value})}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="text-[10px] uppercase tracking-widest font-black text-gray-500">Hora de Fin</Label>
                            <Input 
                              type="time" 
                              className="h-14 bg-white/5 border-white/10 rounded-2xl focus:ring-yellow-400 text-white font-bold"
                              value={formData.fin_de_hora || ""}
                              onChange={(e) => setFormData({...formData, fin_de_hora: e.target.value})}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="text-[10px] uppercase tracking-widest font-black text-gray-500">Participantes (Aprox.)</Label>
                            <Input 
                              type="number"
                              placeholder="Ej: 150"
                              className="h-14 bg-white/5 border-white/10 rounded-2xl focus:ring-yellow-400 text-white font-bold"
                              value={formData.numero_estudiantes ?? ""}
                              onChange={(e) => setFormData({...formData, numero_estudiantes: Number(e.target.value)})}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="text-[10px] uppercase tracking-widest font-black text-gray-500">Responsable</Label>
                            <Input 
                              placeholder="Nombre del responsable"
                              className="h-14 bg-white/5 border-white/10 rounded-2xl text-white"
                              value={formData.responsable || ""}
                              onChange={(e) => setFormData({...formData, responsable: e.target.value})}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="text-[10px] uppercase tracking-widest font-black text-gray-500">Comisión / Equipo</Label>
                            <Input 
                              placeholder="Equipo técnico"
                              className="h-14 bg-white/5 border-white/10 rounded-2xl text-white"
                              value={formData.equipo || ""}
                              onChange={(e) => setFormData({...formData, equipo: e.target.value})}
                            />
                          </div>

                          <div className="col-span-2 space-y-2">
                            <Label className="text-[10px] uppercase tracking-widest font-black text-gray-500">Requerimientos Logísticos</Label>
                            <Textarea 
                              placeholder="Equipos, materiales, espacios..."
                              className="min-h-[80px] bg-white/5 border-white/10 rounded-2xl text-white resize-none"
                              value={formData.requisito || ""}
                              onChange={(e) => setFormData({...formData, requisito: e.target.value})}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="text-[10px] uppercase tracking-widest font-black text-emerald-500">Ingresos Previstos (Bs)</Label>
                            <Input 
                              type="number" 
                              placeholder="0"
                              className="h-14 bg-emerald-500/5 border-emerald-500/20 rounded-2xl font-black text-emerald-500"
                              value={formData.ingreso ?? ""}
                              onChange={(e) => setFormData({...formData, ingreso: Number(e.target.value)})}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="text-[10px] uppercase tracking-widest font-black text-rose-500">Egresos Previstos (Bs)</Label>
                            <Input 
                              type="number" 
                              placeholder="0"
                              className="h-14 bg-rose-500/5 border-rose-500/20 rounded-2xl font-black text-rose-500"
                              value={formData.gastos ?? ""}
                              onChange={(e) => setFormData({...formData, gastos: Number(e.target.value)})}
                            />
                          </div>

                          <div className="space-y-2">
                             <Label className="text-[10px] uppercase tracking-widest font-black text-blue-500">Gestión de Archivos</Label>
                             <p className="text-[10px] text-gray-500 font-medium">Usa la sección de carga en la pantalla principal para gestionar afiches y documentos globales.</p>
                          </div>

                          {editingActivity && formData.historial_cambios && (
                            <div className="col-span-2 space-y-2 pt-4">
                              <Label className="text-[10px] uppercase tracking-widest font-black text-gray-500">Historial de Modificaciones</Label>
                              <div className="p-4 bg-white/5 border border-white/5 rounded-2xl">
                                <Textarea 
                                  readOnly
                                  value={formData.historial_cambios}
                                  className="min-h-[100px] bg-transparent border-none text-[10px] font-mono text-gray-400 p-0 resize-none focus:ring-0"
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="pt-10 flex gap-4">
                          <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="rounded-full h-14 px-8 font-black text-gray-500 hover:text-white hover:bg-white/5">
                            Descartar
                          </Button>
                          <Button onClick={() => setIsConfirmDialogOpen(true)} className="flex-1 rounded-full h-14 px-10 bg-yellow-400 hover:bg-yellow-500 text-black font-black shadow-xl shadow-yellow-400/20 text-lg">
                            Guardar Actividad
                          </Button>
                        </div>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                {/* Confirm Save Dialog */}
                <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
                  <DialogContent className="sm:max-w-md rounded-[2rem] bg-[#1A1A1A] border border-white/10 text-white p-8">
                    <DialogHeader className="space-y-4">
                      <div className="w-12 h-12 bg-yellow-400/10 rounded-2xl flex items-center justify-center mx-auto mb-2">
                        <Sparkles className="w-6 h-6 text-yellow-400" />
                      </div>
                      <DialogTitle className="text-2xl font-black tracking-tighter text-center">Confirmar Registro</DialogTitle>
                      <DialogDescription className="text-gray-400 text-center font-medium text-base">
                        ¿Estás seguro de guardar esta actividad o revisarla nuevamente?
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex flex-row gap-3 mt-8">
                      <Button 
                        variant="ghost" 
                        onClick={() => setIsConfirmDialogOpen(false)} 
                        className="flex-1 rounded-full h-12 font-black text-xs uppercase tracking-widest text-gray-500 hover:text-white hover:bg-white/5 border border-white/5"
                      >
                        Revisar
                      </Button>
                      <Button 
                        onClick={() => {
                          setIsConfirmDialogOpen(false);
                          handleSave();
                        }} 
                        className="flex-1 rounded-full h-12 bg-yellow-400 hover:bg-yellow-500 text-black font-black uppercase tracking-widest text-xs"
                      >
                        Confirmar
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {/* Global File Viewer Dialog */}
                <Dialog open={isFilesDialogOpen} onOpenChange={setIsFilesDialogOpen}>
                  <DialogContent className="sm:max-w-4xl rounded-[2.5rem] bg-[#1A1A1A] border border-white/10 text-white p-0 overflow-hidden">
                    <div className="flex flex-col h-[70vh]">
                      <div className="p-8 border-b border-white/5 bg-black/20">
                         <div className="flex items-center gap-4 mb-4">
                            <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center">
                              <ImageIcon className="w-6 h-6 text-emerald-500" />
                            </div>
                            <div>
                               <DialogTitle className="text-2xl font-black tracking-tighter uppercase">Biblioteca de Archivos</DialogTitle>
                               <DialogDescription className="text-gray-400 font-medium">Visualiza y gestiona todos los recursos digitales de la semana.</DialogDescription>
                            </div>
                         </div>
                      </div>

                      <div className="flex-1 overflow-y-auto p-8 pr-4 space-y-4 scrollbar-hide">
                        {storedFiles.length === 0 ? (
                          <div className="h-full flex flex-col items-center justify-center space-y-4 opacity-50">
                             <Upload className="w-12 h-12 text-gray-600" />
                             <p className="font-black text-xs uppercase tracking-widest text-gray-600">No hay archivos subidos aún</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {storedFiles.map((file) => (
                              <div key={file.id} className="bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center justify-between group hover:border-yellow-400/30 transition-all">
                                <div className="flex items-center gap-4 overflow-hidden">
                                  <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center shrink-0">
                                    <FileText className="w-5 h-5 text-gray-400" />
                                  </div>
                                  <div className="flex flex-col overflow-hidden">
                                    <span className="text-xs font-black text-white truncate max-w-[200px] uppercase tracking-wider">{file.name}</span>
                                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">Subido el {format(new Date(file.created_at), "dd/MM HH:mm")}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button 
                                    variant="ghost" 
                                    className="rounded-full h-10 px-4 font-black text-[10px] uppercase tracking-widest hover:bg-yellow-400 hover:text-black transition-all"
                                    onClick={() => window.open(getFileUrl(file.name), '_blank')}
                                  >
                                    Abrir
                                  </Button>
                                  <button 
                                    onClick={(e) => { 
                                      e.stopPropagation(); 
                                      window.confirm('¿Eliminar?') && eliminarArchivo(file.name); 
                                    }} 
                                    style={{ color: 'red', cursor: 'pointer', padding: '10px' }}
                                    className="hover:bg-red-500/10 rounded-full transition-all flex items-center justify-center"
                                  > 
                                    <Trash2 className="w-5 h-5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="p-8 border-t border-white/5 bg-black/20 flex justify-end items-center gap-4">
                         <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{storedFiles.length} Archivos Almacenados</span>
                         <Button onClick={() => setIsFilesDialogOpen(false)} className="rounded-full px-8 h-12 bg-white/5 border border-white/10 text-white font-black uppercase tracking-widest text-[10px]">
                           Cerrar
                         </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              
              <TabsList className="bg-white/5 p-1 rounded-full hidden lg:flex border border-white/10 h-auto">
                {WEEK_DAYS.map((day) => (
                  <TabsTrigger 
                    key={day.nombre} 
                    value={day.nombre}
                    className="rounded-full px-6 py-2.5 data-[state=active]:bg-yellow-400 data-[state=active]:text-black transition-all font-black text-[10px] uppercase tracking-widest border-none text-gray-400"
                  >
                    {day.nombre}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <div className="w-full">
              <TabsList className="lg:hidden w-full bg-[#141414] border border-white/5 mb-6 flex overflow-x-auto h-auto p-1.5 rounded-2xl scrollbar-hide text-white">
                {WEEK_DAYS.map((day) => (
                  <TabsTrigger 
                    key={day.nombre} 
                    value={day.nombre}
                    className="rounded-xl px-4 py-3 flex-1 font-black text-[10px] uppercase tracking-wider text-gray-400 data-[state=active]:text-yellow-400"
                  >
                    {day.nombre}
                  </TabsTrigger>
                ))}
              </TabsList>

              <AnimatePresence mode="wait">
                <motion.div
                  key={selectedTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <TabsContent value={selectedTab} className="mt-0 focus-visible:outline-none focus:outline-none outline-none">
                  <div className="bg-[#141414] rounded-[3rem] border border-white/5 shadow-3xl overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-b border-white/5 hover:bg-transparent bg-black/20">
                          <TableHead className="w-[120px] py-10 px-10 text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">Horario</TableHead>
                          <TableHead className="py-10 text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">Actividad / Responsable</TableHead>
                          <TableHead className="py-10 text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">Logística & Estudiantes</TableHead>
                          <TableHead className="py-10 text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 text-right">Económico</TableHead>
                          <TableHead className="py-10 text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 text-center">Estado</TableHead>
                          <TableHead className="w-[120px] py-10 pr-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredActivities.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="h-[500px] text-center">
                              <div className="flex flex-col items-center justify-center space-y-8">
                                <div className="w-32 h-32 bg-white/5 rounded-[2.5rem] flex items-center justify-center border border-white/5">
                                  <ClipboardList className="w-12 h-12 text-gray-700" />
                                </div>
                                <div className="space-y-4 max-w-xs">
                                  <h3 className="text-3xl font-black text-white tracking-tighter">Sin registros</h3>
                                  <p className="text-gray-500 font-medium text-sm leading-relaxed">No hay actividades programadas para este día en la agenda académica.</p>
                                </div>
                                <Button 
                                  variant="outline" 
                                  className="rounded-full px-10 h-14 border-2 border-white/10 text-yellow-400 font-black uppercase tracking-widest hover:bg-yellow-400 hover:text-black hover:border-yellow-400"
                                  onClick={() => setIsDialogOpen(true)}
                                >
                                  Empezar Ahora
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredActivities.map((activity) => (
                            <TableRow key={activity.id} className="group border-b border-white/5 hover:bg-white/[0.02] transition-all">
                              <TableCell className="px-10 py-10 align-top">
                                <div className="flex flex-col">
                                  <span className="text-2xl font-black font-mono text-white group-hover:text-yellow-400 transition-colors tracking-tight">
                                    {activity.tiempo}
                                    {activity.fin_de_hora && <span className="text-xs text-gray-600 block mt-1">hasta {activity.fin_de_hora}</span>}
                                  </span>
                                  <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest mt-1">Horario</span>
                                </div>
                              </TableCell>
                              <TableCell className="py-10 align-top max-w-[400px]">
                                <div className="space-y-4">
                                  <h4 className="text-xl font-black leading-tight text-white group-hover:underline underline-offset-4 decoration-yellow-400/50">{activity.descripcion}</h4>
                                  <div className="flex flex-wrap gap-2">
                                    <div className="flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full">
                                      <User className="w-3 h-3 text-gray-500" />
                                      <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">{activity.responsable || "Personal"}</span>
                                    </div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="py-10 align-top">
                                <div className="space-y-6">
                                  <div className="flex items-start gap-4">
                                    <div className="mt-1 p-2 bg-yellow-400/10 rounded-xl border border-yellow-400/20"><Users className="w-4 h-4 text-yellow-400" /></div>
                                    <div className="flex flex-col">
                                      <span className="text-[9px] font-black uppercase tracking-widest text-gray-600 mb-1">Impacto Laboral</span>
                                      <div className="flex items-center gap-3">
                                        <span className="text-xs font-black text-gray-200">{activity.equipo || "Logística"}</span>
                                        {activity.numero_estudiantes && (
                                          <Badge className="bg-emerald-500/10 text-emerald-500 border-none text-[9px] px-2 p-0.5 font-black">{activity.numero_estudiantes} Est.</Badge>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-start gap-4">
                                    <div className="mt-1 p-2 bg-white/5 rounded-xl border border-white/10"><ClipboardList className="w-4 h-4 text-gray-400" /></div>
                                    <div className="flex flex-col">
                                      <span className="text-[9px] font-black uppercase tracking-widest text-gray-600 mb-1">Requerimientos</span>
                                      <span className="text-xs font-medium text-gray-500 italic max-w-[250px] leading-relaxed">
                                        {activity.requisito || "Análisis técnico pendiente"}
                                      </span>
                                      {activity.fichero_url && (
                                        <a 
                                          href={activity.fichero_url} 
                                          target="_blank" 
                                          rel="noreferrer"
                                          className="mt-2 flex items-center gap-2 text-[10px] font-black text-blue-400 uppercase tracking-widest hover:text-blue-300 transition-colors"
                                        >
                                          <FileText className="w-3 h-3" />
                                          Ver Adjunto
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                  
                                  {activity.usuario_email && (
                                    <div className="flex items-center gap-2 mb-2 px-2 py-1 bg-yellow-400/5 rounded-lg border border-yellow-400/10 w-fit">
                                      <User className="w-2.5 h-2.5 text-yellow-500" />
                                      <span className="text-[8px] font-black text-yellow-500/70 uppercase">Modificado por: {activity.usuario_email}</span>
                                    </div>
                                  )}
                                  {activity.historial_cambios && (
                                    <div className="flex items-start gap-4 pt-4 border-t border-white/5 opacity-60">
                                      <div className="mt-0.5 p-1.5 bg-white/5 rounded-lg border border-white/10">
                                        <History className="w-3 h-3 text-gray-500" />
                                      </div>
                                      <div className="flex flex-col">
                                        <span className="text-[8px] font-black uppercase tracking-widest text-gray-600 mb-1">Registro de Auditoría</span>
                                        <div className="text-[9px] text-gray-500 font-mono whitespace-pre-line leading-tight">
                                          {activity.historial_cambios}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="py-10 align-top text-right px-4">
                                <div className="flex flex-col items-end gap-2">
                                  <div className="flex items-center gap-2 text-emerald-500 bg-emerald-500/5 px-2 py-0.5 rounded-lg border border-emerald-500/10">
                                    <span className="text-sm font-black">+{Number(activity.ingreso)}</span>
                                    <TrendingUp className="w-3 h-3" />
                                  </div>
                                  <div className="flex items-center gap-2 text-rose-500 bg-rose-500/5 px-2 py-0.5 rounded-lg border border-rose-500/10">
                                    <span className="text-sm font-black">-{Number(activity.gastos)}</span>
                                    <TrendingDown className="w-3 h-3" />
                                  </div>
                                  <div className="h-px bg-white/5 w-16 my-1" />
                                  <span className="text-base font-black text-white">
                                    {(Number(activity.ingreso) || 0) - (Number(activity.gastos) || 0)} <span className="text-[9px] text-gray-600 uppercase">Bs</span>
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="py-10 align-top text-center">
                                <div className="flex items-center justify-center">
                                  <div className={`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl transition-all ${
                                    activity.resultado?.toLowerCase().includes("confirmado") ? "bg-emerald-500 text-black shadow-emerald-500/10 hover:bg-emerald-400" :
                                    activity.resultado?.toLowerCase().includes("programado") ? "bg-yellow-400 text-black shadow-yellow-400/10 hover:bg-yellow-300" :
                                    activity.resultado?.toLowerCase().includes("plan") ? "bg-white/10 text-white border border-white/10" :
                                    "bg-white/5 text-gray-500"
                                  }`}>
                                    {activity.resultado || "En Cola"}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="py-10 align-top text-right pr-10">
                                <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all transform translate-x-4 group-hover:translate-x-0">
                                  <Button 
                                    variant="outline" 
                                    size="icon" 
                                    className="h-12 w-12 rounded-2xl bg-white/5 border-white/10 hover:border-yellow-400 hover:bg-yellow-400 hover:text-black text-gray-400 transition-colors"
                                    onClick={() => handleEdit(activity)}
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </Button>
                                  <Button 
                                    variant="outline" 
                                    size="icon" 
                                    className="h-12 w-12 rounded-2xl bg-white/5 border-white/10 hover:border-rose-500 hover:bg-rose-500 hover:text-white text-gray-400 transition-colors"
                                    onClick={() => handleDelete(activity.id)}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
              </motion.div>
            </AnimatePresence>
          </div>
        </Tabs>
        </div>
        
        <div className="flex justify-center pb-20">
          <div className="flex items-center gap-12 text-white/10 font-black text-[10px] uppercase tracking-[1em]">
            <span>Excellence</span>
            <div className="w-1 hidden md:block h-1 rounded-full bg-white/10" />
            <span>Integrity</span>
            <div className="w-1 hidden md:block h-1 rounded-full bg-white/10" />
            <span>Success</span>
          </div>
        </div>

      </div>
      <Toaster position="bottom-right" richColors closeButton />
    </div>
  );
}
