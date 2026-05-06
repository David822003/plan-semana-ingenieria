import { useState, useMemo, useEffect } from "react";
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
  Image as ImageIcon
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { GoogleGenAI } from "@google/genai";
import { Toaster, toast } from "sonner";

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
    gastos: 500,
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
    ingreso: 1200,
    gastos: 200,
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
    gastos: 300,
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
    ingreso: 5000,
    gastos: 4500,
    resultado: "Venta de Entradas",
  }
];

export default function App() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [selectedTab, setSelectedTab] = useState<string>("Lunes");
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState<Partial<Activity>>({});

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('actividades')
        .select('*')
        .order('tiempo', { ascending: true });

      if (error) throw error;
      
      // If data is successfully fetched (even if empty), use it
      setActivities(data || []);
      
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

  const handleSave = async () => {
    if (!formData.descripcion) {
      toast.error("Por favor completa los campos obligatorios (Actividad y Hora)");
      return;
    }

    const currentDay = WEEK_DAYS.find(d => d.nombre === selectedTab);
    
    const activityId = editingActivity?.id || Math.random().toString(36).substr(2, 9);
    
    const newActivity: Activity = {
      id: activityId,
      dia: selectedTab as DayName,
      fecha: currentDay?.fecha || "",
      tiempo: formData.tiempo || "00:00",
      fin_de_hora: formData.fin_de_hora || "",
      descripcion: formData.descripcion || "",
      responsable: formData.responsable || "",
      equipo: formData.equipo || "",
      requisito: formData.requisito || "",
      numero_estudiantes: Number(formData.numero_estudiantes) || 0,
      ingreso: Number(formData.ingreso) || 0,
      gastos: Number(formData.gastos) || 0,
      resultado: formData.resultado || "",
    };

    try {
      // Data sanitization: Ensure numbers are numbers and empty strings are null
      const payload = {
        id: activityId,
        dia: selectedTab as DayName,
        fecha: currentDay?.fecha || null,
        tiempo: formData.tiempo || null,
        fin_de_hora: formData.fin_de_hora || null,
        descripcion: formData.descripcion || null,
        responsable: formData.responsable || null,
        equipo: formData.equipo || null,
        requisito: formData.requisito || null,
        ingreso: Number(formData.ingreso || 0),
        gastos: Number(formData.gastos || 0),
        resultado: formData.resultado || null,
        numero_estudiantes: Number(formData.numero_estudiantes || 0)
      };

      console.log("Columnas enviadas:", Object.keys(payload));
      console.log("Valores del payload:", payload);

      const { data, error, status, statusText } = await supabase
        .from('actividades')
        .insert(payload)
        .select();

      if (error) {
        console.error("Supabase Error details:", {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          status,
          statusText
        });
        throw error;
      }

      if (editingActivity) {
        setActivities(prev => prev.map(a => a.id === editingActivity.id ? newActivity : a));
        toast.success("Actividad actualizada correctamente");
      } else {
        setActivities(prev => [...prev, newActivity]);
        toast.success("Actividad añadida correctamente");
      }

      // Sync local storage as backup
      localStorage.setItem("civil-plan-actividades", JSON.stringify([...activities.filter(a => a.id !== activityId), newActivity]));

      setIsDialogOpen(false);
      setEditingActivity(null);
      setFormData({});
    } catch (error: any) {
      console.error("Error saving to Supabase:", error);
      const errorMsg = error.message || error.details || "Error desconocido";
      toast.error(`Error al guardar: ${errorMsg}`);
      
      if (error.code === '42P1' || error.message?.includes('column')) {
        toast.warning("Parece que hay un desajuste entre las columnas del código y la base de datos.");
      }
    }
  };

  const suggestWithAi = async () => {
    if (!formData.descripcion) {
      toast.error("Ingresa primero la descripción de la actividad para sugerir requerimientos.");
      return;
    }

    setIsAiLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
      
      const prompt = `Actúa como un organizador de eventos académicos para la facultad de Ingeniería Civil. 
      La actividad es: "${formData.descripcion}".
      Sugiere una lista breve de requerimientos (ej: proyector, refrigerio, sonido) y un equipo de trabajo ideal (ej: comisión logística).
      Responde SOLO en formato JSON con las llaves "requirement" (string) y "team" (string). 
      Se breve y profesional. Lenguaje: Español.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      const text = response.text || "";
      const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
      const data = JSON.parse(cleanJson);
      
      setFormData(prev => ({
        ...prev,
        requisito: data.requirement,
        equipo: data.team
      }));
      toast.success("Sugerencias aplicadas con éxito");
    } catch (error) {
      console.error(error);
      toast.error("No se pudo obtener sugerencias de la IA.");
    } finally {
      setIsAiLoading(false);
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

      setActivities(prev => prev.filter(a => a.id !== id));
      localStorage.setItem("civil-plan-actividades", JSON.stringify(activities.filter(a => a.id !== id)));
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
               <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Semana Académica Activa</span>
            </div>
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
              <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Plataforma de Alta Gestión</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-white leading-[0.9]">
              Maestría en <span className="text-yellow-400">Planificación</span>
            </h1>
            <p className="text-gray-400 text-lg max-w-md font-medium leading-relaxed opacity-80">
              Control total de la agenda académica, logística y presupuesto para el Centro de Estudiantes de Civil.
            </p>
            <div className="pt-4 max-w-md">
              <div 
                className="group/upload border-2 border-dashed border-white/10 rounded-[2.5rem] p-8 flex flex-col items-center justify-center gap-4 bg-white/[0.02] hover:bg-white/[0.05] hover:border-yellow-400/50 transition-all cursor-pointer relative overflow-hidden"
                onClick={() => document.getElementById('poster-upload')?.click()}
              >
                <input 
                  type="file" 
                  id="poster-upload" 
                  className="hidden" 
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) toast.success(`Afiche "${file.name}" cargado exitosamente`);
                  }}
                />
                <div className="w-16 h-16 bg-yellow-400/10 rounded-2xl flex items-center justify-center group-hover/upload:scale-110 transition-transform">
                   <Upload className="w-8 h-8 text-yellow-400" />
                </div>
                <div className="text-center">
                  <span className="text-sm font-black text-white block">Subir Afiches o Anuncios</span>
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">Formato: JPG, PNG, PDF</span>
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-yellow-400/5 to-transparent opacity-0 group-hover/upload:opacity-100 transition-opacity" />
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
                {activities.reduce((acc, a) => acc + (Number(a.numero_estudiantes) || 0), 0)}
              </div>
            </Card>
            <Card className="rounded-[2.5rem] border border-white/5 bg-[#1A1A1A] text-white p-8 space-y-2 group transition-all hover:border-white/20 col-span-2">
               <div className="flex justify-between items-end">
                 <div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Balance Financiero</span>
                    <div className="text-4xl font-black tracking-tighter mt-1">
                      {activities.reduce((acc, a) => acc + (Number(a.ingreso) || 0) - (Number(a.gastos) || 0), 0)}<span className="text-sm ml-1 text-gray-600">Bs</span>
                    </div>
                 </div>
                 <div className="flex gap-4">
                    <div className="text-right">
                      <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest block">Ingresos</span>
                      <span className="font-bold text-emerald-500">+{activities.reduce((acc, a) => acc + (Number(a.ingreso) || 0), 0)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest block">Gastos</span>
                      <span className="font-bold text-rose-500">-{activities.reduce((acc, a) => acc + (Number(a.gastos) || 0), 0)}</span>
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
                          <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">Recomendación</span>
                            <p className="text-[10px] text-gray-400 font-medium">Usa la IA para generar requerimientos automáticos basados en la descripción.</p>
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
                              value={formData.numero_estudiantes || ""}
                              onChange={(e) => setFormData({...formData, numero_estudiantes: Number(e.target.value)})}
                            />
                          </div>

                          <div className="col-span-2">
                             <Button 
                              type="button" 
                              variant="secondary" 
                              onClick={suggestWithAi}
                              className="w-full rounded-2xl h-12 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 flex gap-2 font-black text-xs uppercase tracking-widest transition-all border border-emerald-500/20"
                              disabled={isAiLoading || !formData.descripcion}
                            >
                              {isAiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                              Autocompletar con Inteligencia Artificial
                            </Button>
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
                              value={formData.ingreso || ""}
                              onChange={(e) => setFormData({...formData, ingreso: Number(e.target.value)})}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="text-[10px] uppercase tracking-widest font-black text-rose-500">Egresos Previstos (Bs)</Label>
                            <Input 
                              type="number" 
                              placeholder="0"
                              className="h-14 bg-rose-500/5 border-rose-500/20 rounded-2xl font-black text-rose-500"
                              value={formData.gastos || ""}
                              onChange={(e) => setFormData({...formData, gastos: Number(e.target.value)})}
                            />
                          </div>
                        </div>

                        <div className="pt-10 flex gap-4">
                          <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="rounded-full h-14 px-8 font-black text-gray-500 hover:text-white hover:bg-white/5">
                            Descartar
                          </Button>
                          <Button onClick={handleSave} className="flex-1 rounded-full h-14 px-10 bg-yellow-400 hover:bg-yellow-500 text-black font-black shadow-xl shadow-yellow-400/20 text-lg">
                            Guardar Actividad
                          </Button>
                        </div>
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
                                    </div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="py-10 align-top text-right px-4">
                                <div className="flex flex-col items-end gap-2">
                                  <div className="flex items-center gap-2 text-emerald-500 bg-emerald-500/5 px-2 py-0.5 rounded-lg border border-emerald-500/10">
                                    <span className="text-sm font-black">+{activity.ingreso}</span>
                                    <TrendingUp className="w-3 h-3" />
                                  </div>
                                  <div className="flex items-center gap-2 text-rose-500 bg-rose-500/5 px-2 py-0.5 rounded-lg border border-rose-500/10">
                                    <span className="text-sm font-black">-{activity.gastos}</span>
                                    <TrendingDown className="w-3 h-3" />
                                  </div>
                                  <div className="h-px bg-white/5 w-16 my-1" />
                                  <span className="text-base font-black text-white">
                                    {(activity.ingreso || 0) - (activity.gastos || 0)} <span className="text-[9px] text-gray-600 uppercase">Bs</span>
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
