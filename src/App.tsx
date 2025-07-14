import React, { useState, useEffect } from 'react';
import { Calculator, Save, BarChart3, AlertCircle, Search, Users, Calendar, Trash2, Edit3, Check, X, Eye, DollarSign } from 'lucide-react';
import { supabase, Registro, SalidaDetalle } from './lib/supabase';
import ExitReasonsModal, { ExitReasonEntry } from './components/ExitReasonsModal';
import ExitDetailsModal from './components/ExitDetailsModal';
import SalesTableModal from './components/SalesTableModal';

function App() {
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [formData, setFormData] = useState({
    socio: '',
    fecha: '',
    entradas: '',
    salidas: '',
    kgTotales: '',
    vrKilo: '',
    fletes: '',
    comision: ''
  });
  const [resultados, setResultados] = useState({
    saldo: 0,
    valorAnimal: 0,
    total: 0,
    divisorFlete: 1
  });
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [socioSeleccionado, setSocioSeleccionado] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<Partial<Registro>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  
  // Modal states
  const [showExitReasonsModal, setShowExitReasonsModal] = useState(false);
  const [showExitDetailsModal, setShowExitDetailsModal] = useState(false);
  const [showSalesTableModal, setShowSalesTableModal] = useState(false);
  const [selectedExitDetails, setSelectedExitDetails] = useState<SalidaDetalle[]>([]);
  const [selectedRegistroForExits, setSelectedRegistroForExits] = useState<Registro | null>(null);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    loadRegistros();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const loadRegistros = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('registros')
        .select('*')
        .order('fecha', { ascending: false });

      if (error) throw error;

      const registrosConvertidos = data.map(registro => ({
        ...registro,
        id: registro.id,
        socio: registro.socio,
        fecha: registro.fecha,
        entradas: registro.entradas || 0,
        salidas: registro.salidas || 0,
        saldo: registro.saldo || 0,
        kg_totales: registro.kg_totales || 0,
        vr_kilo: registro.vr_kilo || 0,
        fletes: registro.fletes || 0,
        comision: registro.comision || 0,
        valor_animal: registro.valor_animal || 0,
        total: registro.total || 0
      }));

      // Recalcular todos los registros
      const registrosRecalculados = await recalcularTodosLosRegistros(registrosConvertidos);
      setRegistros(registrosRecalculados);

      // Seleccionar el primer socio si no hay uno seleccionado
      if (registrosRecalculados.length > 0 && !socioSeleccionado) {
        const primerSocio = registrosRecalculados[0].socio;
        setSocioSeleccionado(primerSocio);
      }
    } catch (error) {
      console.error('Error loading registros:', error);
      setError('Error al cargar los registros');
    } finally {
      setLoading(false);
    }
  };

  const recalcularTodosLosRegistros = async (registrosOriginales: Registro[]) => {
    const registrosRecalculados = [];
    
    for (const registro of registrosOriginales) {
      // Contar cuántas entradas tiene el mismo socio en la misma fecha
      const entradasMismaFecha = registrosOriginales.filter(r => 
        r.socio === registro.socio && r.fecha === registro.fecha
      ).length;

      // Recalcular el total con el divisor correcto
      const nuevoTotal = (registro.kg_totales * registro.vr_kilo) + (registro.fletes / entradasMismaFecha);
      
      // Recalcular valor por animal
      const nuevoValorAnimal = registro.entradas > 0 ? nuevoTotal / registro.entradas : 0;

      // Recalcular saldo
      const nuevoSaldo = registro.entradas - registro.salidas;

      const registroRecalculado = {
        ...registro,
        saldo: nuevoSaldo,
        total: nuevoTotal,
        valor_animal: nuevoValorAnimal
      };

      registrosRecalculados.push(registroRecalculado);

      // Actualizar en la base de datos
      try {
        await supabase
          .from('registros')
          .update({
            saldo: nuevoSaldo,
            total: nuevoTotal,
            valor_animal: nuevoValorAnimal
          })
          .eq('id', registro.id);
      } catch (error) {
        console.error('Error updating registro:', error);
      }
    }

    return registrosRecalculados;
  };

  const contarEntradasPorSocioYFecha = (socio: string, fecha: string) => {
    if (!socio || !fecha) return 1;
    
    const count = registros.filter(registro => 
      registro && registro.socio && registro.socio === socio && registro.fecha === fecha
    ).length;
    
    return count + 1;
  };

  const calcularResultados = () => {
    const entradas = parseFloat(formData.entradas) || 0;
    const salidas = parseFloat(formData.salidas) || 0;
    const kgTotales = parseFloat(formData.kgTotales) || 0;
    const vrKilo = parseFloat(formData.vrKilo) || 0;
    const fletes = parseFloat(formData.fletes) || 0;

    const saldo = entradas - salidas;

    let valorTotal = 0;
    let divisorFlete = 1;
    
    try {
      if (kgTotales > 0 && vrKilo > 0) {
        divisorFlete = contarEntradasPorSocioYFecha(formData.socio, formData.fecha);
        valorTotal = (kgTotales * vrKilo) + (fletes / divisorFlete);
      }
    } catch (error) {
      valorTotal = 0;
    }

    let valorAnimal = 0;
    try {
      if (entradas > 0 && valorTotal > 0) {
        valorAnimal = valorTotal / entradas;
      }
    } catch (error) {
      valorAnimal = 0;
    }

    setResultados({
      saldo,
      valorAnimal,
      total: valorTotal,
      divisorFlete
    });
  };

  useEffect(() => {
    calcularResultados();
  }, [formData, registros]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSalidasChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData(prev => ({
      ...prev,
      salidas: value
    }));

    // Si hay salidas, mostrar el modal para especificar las causas
    if (parseInt(value) > 0) {
      setSelectedRegistroForExits({
        id: '',
        socio: formData.socio,
        fecha: formData.fecha,
        entradas: parseInt(formData.entradas) || 0,
        salidas: parseInt(value) || 0,
        saldo: 0,
        kg_totales: parseFloat(formData.kgTotales) || 0,
        vr_kilo: parseFloat(formData.vrKilo) || 0,
        fletes: parseFloat(formData.fletes) || 0,
        comision: parseFloat(formData.comision) || 0,
        valor_animal: 0,
        total: 0
      });
      setShowExitReasonsModal(true);
    }
  };

  const handleExitReasonsSave = async (exitReasons: ExitReasonEntry[]) => {
    setShowExitReasonsModal(false);
    // Los detalles de salida se guardarán cuando se guarde el registro completo
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.socio.trim()) {
      alert('Por favor ingrese el nombre del socio');
      return;
    }

    try {
      setLoading(true);

      const nuevoRegistro = {
        socio: formData.socio.trim().toUpperCase(),
        fecha: formData.fecha,
        entradas: parseFloat(formData.entradas) || 0,
        salidas: parseFloat(formData.salidas) || 0,
        saldo: resultados.saldo,
        kg_totales: parseFloat(formData.kgTotales) || 0,
        vr_kilo: parseFloat(formData.vrKilo) || 0,
        fletes: parseFloat(formData.fletes) || 0,
        comision: parseFloat(formData.comision) || 0,
        valor_animal: resultados.valorAnimal,
        total: resultados.total
      };

      const { data, error } = await supabase
        .from('registros')
        .insert([nuevoRegistro])
        .select()
        .single();

      if (error) throw error;

      // Si hay salidas, necesitamos guardar los detalles
      const salidas = parseFloat(formData.salidas) || 0;
      if (salidas > 0) {
        // Mostrar modal para especificar causas de salida
        setSelectedRegistroForExits({
          ...data,
          kg_totales: data.kg_totales,
          vr_kilo: data.vr_kilo,
          valor_animal: data.valor_animal
        });
        setShowExitReasonsModal(true);
      }

      // Recargar registros
      await loadRegistros();

      // Si es el primer registro o no hay socio seleccionado, seleccionar este socio
      if (!socioSeleccionado || registros.length === 0) {
        setSocioSeleccionado(nuevoRegistro.socio);
      }

      // Limpiar formulario
      setFormData({
        socio: '',
        fecha: '',
        entradas: '',
        salidas: '',
        kgTotales: '',
        vrKilo: '',
        fletes: '',
        comision: ''
      });

      if (salidas === 0) {
        alert('Registro guardado exitosamente.');
      }
    } catch (error) {
      console.error('Error saving registro:', error);
      alert('Error al guardar el registro');
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (registro: Registro) => {
    setEditingId(registro.id);
    setEditingData({
      socio: registro.socio,
      fecha: registro.fecha,
      entradas: registro.entradas,
      salidas: registro.salidas,
      kg_totales: registro.kg_totales,
      vr_kilo: registro.vr_kilo,
      fletes: registro.fletes,
      comision: registro.comision
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingData({});
  };

  const saveEditing = async () => {
    if (!editingId) return;

    try {
      setLoading(true);

      const registroActualizado = {
        socio: (editingData.socio || '').toString().toUpperCase(),
        fecha: editingData.fecha,
        entradas: parseFloat(editingData.entradas?.toString() || '0') || 0,
        salidas: parseFloat(editingData.salidas?.toString() || '0') || 0,
        kg_totales: parseFloat(editingData.kg_totales?.toString() || '0') || 0,
        vr_kilo: parseFloat(editingData.vr_kilo?.toString() || '0') || 0,
        fletes: parseFloat(editingData.fletes?.toString() || '0') || 0,
        comision: parseFloat(editingData.comision?.toString() || '0') || 0
      };

      const { error } = await supabase
        .from('registros')
        .update(registroActualizado)
        .eq('id', editingId);

      if (error) throw error;

      // Recargar registros
      await loadRegistros();
      
      setEditingId(null);
      setEditingData({});
      
      alert('Registro actualizado exitosamente.');
    } catch (error) {
      console.error('Error updating registro:', error);
      alert('Error al actualizar el registro');
    } finally {
      setLoading(false);
    }
  };

  const handleEditingChange = (field: string, value: string | number) => {
    setEditingData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const limpiarTodosLosDatos = async () => {
    if (window.confirm('¿Estás seguro de que quieres eliminar todos los registros? Esta acción no se puede deshacer.')) {
      try {
        setLoading(true);
        
        // Eliminar todos los detalles de salida primero
        await supabase.from('salidas_detalle').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        
        // Luego eliminar todos los registros
        await supabase.from('registros').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        
        setRegistros([]);
        setSocioSeleccionado('');
        alert('Todos los datos han sido eliminados');
      } catch (error) {
        console.error('Error deleting data:', error);
        alert('Error al eliminar los datos');
      } finally {
        setLoading(false);
      }
    }
  };

  const showExitDetails = async (registro: Registro) => {
    try {
      const { data, error } = await supabase
        .from('salidas_detalle')
        .select('*')
        .eq('registro_id', registro.id);

      if (error) throw error;

      setSelectedExitDetails(data || []);
      setSelectedRegistroForExits(registro);
      setShowExitDetailsModal(true);
    } catch (error) {
      console.error('Error loading exit details:', error);
      alert('Error al cargar los detalles de salida');
    }
  };

  const formatCurrency = (value: number) => {
    return `$${Math.round(value).toLocaleString('es-CO')}`;
  };

  // Obtener lista única de socios para el selector
  const sociosUnicos = [...new Set(registros
    .filter(r => r && r.socio && typeof r.socio === 'string')
    .map(r => r.socio)
  )].sort();

  // Filtrar registros del socio seleccionado
  const registrosDelSocio = registros.filter(registro => 
    registro && 
    registro.socio === socioSeleccionado
  ).sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

  // Estadísticas del socio seleccionado
  const estadisticasDelSocio = {
    totalRegistros: registrosDelSocio.length,
    totalEntradas: registrosDelSocio.reduce((sum, reg) => sum + (reg.entradas || 0), 0),
    totalSalidas: registrosDelSocio.reduce((sum, reg) => sum + (reg.salidas || 0), 0),
    totalAcumulado: registrosDelSocio.reduce((sum, reg) => sum + (reg.total || 0), 0)
  };

  if (loading && registros.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando registros...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <div className="bg-emerald-600 p-3 rounded-full mr-4">
                <Calculator className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-gray-800">
                Registros Ganaderos 
              </h1>
            </div>
            <p className="text-gray-600 text-lg">
              Sistema de Registro Ganadero
            </p>
            {isOffline && (
              <div className="mt-4 bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded-lg flex items-center justify-center">
                <AlertCircle className="w-5 h-5 mr-2" />
                Sin conexión - Funcionalidad limitada
              </div>
            )}
            
            {error && (
              <div className="mt-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg flex items-center justify-center">
                <AlertCircle className="w-5 h-5 mr-2" />
                {error}
              </div>
            )}
            
            {/* Botón para limpiar datos */}
            <div className="mt-4">
              {/*<button
                onClick={limpiarTodosLosDatos}
                disabled={loading}
                className="bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors font-medium shadow-lg hover:shadow-xl flex items-center mx-auto disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Eliminar Todos los Datos
              </button>*/}
            </div>
          </div>

          {/* Selector de Socio */}
          <div className="mb-8 bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <Search className="w-5 h-5 mr-2 text-emerald-600" />
              Seleccionar Socio
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Socio a Visualizar
                </label>
                <select
                  value={socioSeleccionado}
                  onChange={(e) => setSocioSeleccionado(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                >
                  <option value="">Seleccionar socio...</option>
                  {sociosUnicos.map(socio => (
                    <option key={socio} value={socio}>
                      {socio}
                    </option>
                  ))}
                </select>
              </div>
              
              {socioSeleccionado && (
                <div className="text-sm text-gray-600">
                  <strong>Socio seleccionado:</strong> {socioSeleccionado}
                  <br />
                  <strong>Registros:</strong> {estadisticasDelSocio.totalRegistros}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Formulario */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-6 flex items-center">
                <Save className="w-5 h-5 mr-2 text-emerald-600" />
                Nuevo Registro
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Socio *
                  </label>
                  <input
                    type="text"
                    name="socio"
                    value={formData.socio}
                    onChange={(e) => {
                      const { name, value } = e.target;
                      setFormData(prev => ({
                        ...prev,
                        [name]: value.toUpperCase()
                      }));
                    }}
                    required
                    placeholder="Nombre del socio"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fecha *
                  </label>
                  <input
                    type="date"
                    name="fecha"
                    value={formData.fecha}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Entradas
                    </label>
                    <input
                      type="number"
                      name="entradas"
                      value={formData.entradas}
                      onChange={handleInputChange}
                      min="0"
                      step="1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Salidas
                    </label>
                    <input
                      type="number"
                      name="salidas"
                      value={formData.salidas}
                      onChange={handleSalidasChange}
                      min="0"
                      step="1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Kg Totales
                    </label>
                    <input
                      type="number"
                      name="kgTotales"
                      value={formData.kgTotales}
                      onChange={handleInputChange}
                      min="0"
                      step="0.01"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Valor por Kilo
                    </label>
                    <input
                      type="number"
                      name="vrKilo"
                      value={formData.vrKilo}
                      onChange={handleInputChange}
                      min="0"
                      step="0.01"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Fletes
                    </label>
                    <input
                      type="number"
                      name="fletes"
                      value={formData.fletes}
                      onChange={handleInputChange}
                      min="0"
                      step="0.01"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Comisión
                    </label>
                    <input
                      type="number"
                      name="comision"
                      value={formData.comision}
                      onChange={handleInputChange}
                      min="0"
                      step="0.01"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-emerald-600 text-white py-3 px-4 rounded-lg hover:bg-emerald-700 transition-colors font-medium shadow-lg hover:shadow-xl disabled:opacity-50"
                >
                  {loading ? 'Guardando...' : 'Guardar Registro'}
                </button>
              </form>
            </div>

            {/* Resultados */}
            <div className="space-y-6">
              {/* Cálculos en tiempo real */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                  <BarChart3 className="w-5 h-5 mr-2 text-emerald-600" />
                  Resultados Calculados
                </h3>
                
                <div className="space-y-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <label className="block text-sm font-medium text-blue-700 mb-1">
                      Saldo (Entradas - Salidas)
                    </label>
                    <div className="text-2xl font-bold text-blue-900">
                      {resultados.saldo.toFixed(0)} animales
                    </div>
                  </div>
                  
                  <div className="bg-green-50 p-4 rounded-lg">
                    <label className="block text-sm font-medium text-green-700 mb-1">
                      Valor por Animal (Fórmula I: J/B)
                    </label>
                    <div className="text-2xl font-bold text-green-900">
                      {`$${Math.round(resultados.valorAnimal).toLocaleString('es-CO')}`}
                    </div>
                  </div>
                  
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <label className="block text-sm font-medium text-purple-700 mb-1">
                      Valor Total (Fórmula J: (E×F)+G/COUNT)
                    </label>
                    <div className="text-2xl font-bold text-purple-900">
                      {`$${Math.round(resultados.total).toLocaleString('es-CO')}`}
                    </div>
                    {formData.socio && formData.fecha && formData.fletes && (
                      <div className="text-xs text-purple-600 mt-2 bg-purple-100 p-2 rounded">
                        <strong>Cálculo:</strong> ({Math.round(parseFloat(formData.kgTotales) || 0)} × {Math.round(parseFloat(formData.vrKilo) || 0)}) + ({Math.round(parseFloat(formData.fletes) || 0)} ÷ {resultados.divisorFlete})
                        <br />
                        <strong>Flete dividido por:</strong> {resultados.divisorFlete} entrada(s) de {formData.socio} en {formData.fecha}
                        <br />
                        <strong>Nota:</strong> Al guardar, TODOS los registros del mismo socio y fecha se recalcularán automáticamente
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Estadísticas del Socio Seleccionado */}
              {socioSeleccionado && (
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">
                    Estadísticas de {socioSeleccionado}
                  </h3>
                  
                  {/* Botón de Ventas */}
                  <div className="mb-4">
                    <button
                      onClick={() => setShowSalesTableModal(true)}
                      className="bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors text-sm font-medium flex items-center"
                    >
                      <DollarSign className="w-4 h-4 mr-1" />
                      Ventas
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-emerald-600">
                        {estadisticasDelSocio.totalRegistros}
                      </div>
                      <div className="text-sm text-gray-600">
                        Registros Totales
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {estadisticasDelSocio.totalEntradas}
                      </div>
                      <div className="text-sm text-gray-600">
                        Total Entradas
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {estadisticasDelSocio.totalSalidas}
                      </div>
                      <div className="text-sm text-gray-600">
                        Total Salidas
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">
                        {`$${Math.round(estadisticasDelSocio.totalAcumulado).toLocaleString('es-CO')}`}
                      </div>
                      <div className="text-sm text-gray-600">
                        Total Acumulado
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Tabla de registros del socio seleccionado */}
          {socioSeleccionado && registrosDelSocio.length > 0 && (
            <div className="mt-8 bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                  <Users className="w-5 h-5 mr-2 text-emerald-600" />
                  Registros de {socioSeleccionado}
                  <span className="ml-2 text-sm text-gray-500">
                    ({registrosDelSocio.length} registros)
                  </span>
                </h3>
              </div>
              
              <div className="max-h-96 overflow-y-auto">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Acciones
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Fecha
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Entradas
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Salidas
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Saldo
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Kg Totales
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Valor/Kg
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Fletes
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Valor/Animal
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {registrosDelSocio.map((registro) => {
                        const entradasMismaFecha = registros.filter(r => 
                          r && r.socio && r.socio === registro.socio && r.fecha === registro.fecha
                        ).length;
                        
                        const isEditing = editingId === registro.id;
                        
                        return (
                          <tr key={registro.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                              {isEditing ? (
                                <div className="flex space-x-1">
                                  <button
                                    onClick={saveEditing}
                                    className="text-green-600 hover:text-green-800 p-1"
                                    title="Guardar"
                                  >
                                    <Check className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={cancelEditing}
                                    className="text-red-600 hover:text-red-800 p-1"
                                    title="Cancelar"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => startEditing(registro)}
                                  className="text-blue-600 hover:text-blue-800 p-1"
                                  title="Editar"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                              {isEditing ? (
                                <input
                                  type="date"
                                  value={editingData.fecha || ''}
                                  onChange={(e) => handleEditingChange('fecha', e.target.value)}
                                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                                />
                              ) : (
                                <div className="flex items-center">
                                  <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                                  {new Date(registro.fecha + 'T00:00:00').toLocaleDateString('es-CO')}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                              {isEditing ? (
                                <input
                                  type="number"
                                  value={editingData.entradas || ''}
                                  onChange={(e) => handleEditingChange('entradas', e.target.value)}
                                  className="w-16 px-2 py-1 border border-gray-300 rounded text-xs"
                                  min="0"
                                />
                              ) : (
                                registro.entradas || 0
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                              {isEditing ? (
                                <input
                                  type="number"
                                  value={editingData.salidas || ''}
                                  onChange={(e) => handleEditingChange('salidas', e.target.value)}
                                  className="w-16 px-2 py-1 border border-gray-300 rounded text-xs"
                                  min="0"
                                />
                              ) : (
                                <button
                                  onClick={() => showExitDetails(registro)}
                                  className="flex items-center text-blue-600 hover:text-blue-800 transition-colors"
                                  title="Ver detalles de salidas"
                                >
                                  {registro.salidas || 0}
                                  {(registro.salidas || 0) > 0 && (
                                    <Eye className="w-3 h-3 ml-1" />
                                  )}
                                </button>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                              <span className={`font-medium ${(registro.saldo || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {registro.saldo || 0}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                              {isEditing ? (
                                <input
                                  type="number"
                                  value={editingData.kg_totales || ''}
                                  onChange={(e) => handleEditingChange('kg_totales', e.target.value)}
                                  className="w-20 px-2 py-1 border border-gray-300 rounded text-xs"
                                  min="0"
                                  step="0.01"
                                />
                              ) : (
                                `${Math.round(registro.kg_totales || 0)} kg`
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                              {isEditing ? (
                                <input
                                  type="number"
                                  value={editingData.vr_kilo || ''}
                                  onChange={(e) => handleEditingChange('vr_kilo', e.target.value)}
                                  className="w-20 px-2 py-1 border border-gray-300 rounded text-xs"
                                  min="0"
                                  step="0.01"
                                />
                              ) : (
                                `$${Math.round(registro.vr_kilo || 0).toLocaleString('es-CO')}`
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                              {isEditing ? (
                                <input
                                  type="number"
                                  value={editingData.fletes || ''}
                                  onChange={(e) => handleEditingChange('fletes', e.target.value)}
                                  className="w-20 px-2 py-1 border border-gray-300 rounded text-xs"
                                  min="0"
                                  step="0.01"
                                />
                              ) : (
                                <div>
                                  {`$${Math.round(registro.fletes || 0).toLocaleString('es-CO')}`}
                                  <div className="text-xs text-gray-500">
                                    ÷{entradasMismaFecha} entrada(s)
                                  </div>
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                              {`$${Math.round(registro.valor_animal || 0).toLocaleString('es-CO')}`}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-medium">
                              {`$${Math.round(registro.total || 0).toLocaleString('es-CO')}`}
                              <div className="text-xs text-gray-500">
                                ({Math.round(registro.kg_totales || 0)}×{Math.round(registro.vr_kilo || 0)})+({Math.round(registro.fletes || 0)}÷{entradasMismaFecha})
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Mensaje cuando no hay socio seleccionado */}
          {!socioSeleccionado && registros.length > 0 && (
            <div className="mt-8 bg-white rounded-xl shadow-lg p-8 text-center">
              <div className="text-gray-400 mb-4">
                <Users className="w-16 h-16 mx-auto" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Selecciona un socio para ver sus registros
              </h3>
              <p className="text-gray-500">
                Usa el selector de arriba para elegir el socio cuyos datos quieres visualizar.
              </p>
            </div>
          )}

          {/* Mensaje cuando no hay registros */}
          {registros.length === 0 && !loading && (
            <div className="mt-8 bg-white rounded-xl shadow-lg p-8 text-center">
              <div className="text-gray-400 mb-4">
                <Users className="w-16 h-16 mx-auto" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No hay registros aún
              </h3>
              <p className="text-gray-500">
                Comienza agregando tu primer registro de socio para ver el historial aquí.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modales */}
      <ExitReasonsModal
        isOpen={showExitReasonsModal}
        onClose={() => setShowExitReasonsModal(false)}
        onSave={handleExitReasonsSave}
        totalExits={selectedRegistroForExits?.salidas || 0}
        socio={selectedRegistroForExits?.socio || ''}
        fecha={selectedRegistroForExits?.fecha || ''}
        registroId={selectedRegistroForExits?.id}
      />

      <SalesTableModal
        isOpen={showSalesTableModal}
        onClose={() => setShowSalesTableModal(false)}
        socioSeleccionado={socioSeleccionado}
      />

      <ExitDetailsModal
        isOpen={showExitDetailsModal}
        onClose={() => setShowExitDetailsModal(false)}
        exitDetails={selectedExitDetails}
        socio={selectedRegistroForExits?.socio || ''}
        fecha={selectedRegistroForExits?.fecha || ''}
        totalExits={selectedRegistroForExits?.salidas || 0}
      />
    </div>
  );
}

export default App;