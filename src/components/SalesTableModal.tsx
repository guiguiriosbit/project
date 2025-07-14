import React, { useState, useEffect } from 'react';
import { X, Calendar, DollarSign, TrendingUp, Users } from 'lucide-react';
import { supabase, Registro, SalidaDetalle } from '../lib/supabase';

interface SalesTableModalProps {
  isOpen: boolean;
  onClose: () => void;
  socioSeleccionado?: string;
}

interface VentaData {
  fecha_venta: string;
  inventario: number;
  salidas_venta: number;
  salidas_muerte: number;
  salidas_robo: number;
  vr_kilo_venta: number;
  total_kilos_venta: number;
  total_venta: number;
  porcentaje_60: number;
  porcentaje_40: number;
  inventario_actual: number;
  socio: string;
}

const SalesTableModal: React.FC<SalesTableModalProps> = ({
  isOpen,
  onClose,
  socioSeleccionado
}) => {
  const [ventasData, setVentasData] = useState<VentaData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      loadVentasData();
    }
  }, [isOpen, socioSeleccionado]);

  const loadVentasData = async () => {
    try {
      setLoading(true);
      setError('');

      // Obtener todos los registros
      const { data: registros, error: registrosError } = await supabase
        .from('registros')
        .select('*')
        .order('fecha', { ascending: false });

      if (registrosError) throw registrosError;

      // Obtener todos los detalles de salidas que sean ventas
      const { data: salidasDetalle, error: salidasError } = await supabase
        .from('salidas_detalle')
        .select('*')
        .eq('causa', 'ventas');

      if (salidasError) throw salidasError;

      // Procesar datos para crear la tabla de ventas
      const ventasProcessed: VentaData[] = [];

      // Agrupar por socio y fecha las ventas
      const ventasPorSocioFecha = salidasDetalle.reduce((acc, salida) => {
        const key = `${salida.socio}-${salida.fecha}`;
        if (!acc[key]) {
          acc[key] = {
            socio: salida.socio,
            fecha: salida.fecha,
            cantidad_ventas: 0
          };
        }
        acc[key].cantidad_ventas += salida.cantidad;
        return acc;
      }, {} as Record<string, { socio: string; fecha: string; cantidad_ventas: number }>);

      // Para cada venta, calcular los datos necesarios
      for (const ventaKey in ventasPorSocioFecha) {
        const venta = ventasPorSocioFecha[ventaKey];
        
        // Filtrar por socio si está seleccionado
        if (socioSeleccionado && venta.socio !== socioSeleccionado) {
          continue;
        }

        // Calcular inventario total del socio hasta esa fecha
        const inventarioTotal = registros
          .filter(r => r.socio === venta.socio && r.fecha <= venta.fecha)
          .reduce((sum, r) => sum + (r.entradas || 0), 0);

        // Obtener todas las salidas del socio en esa fecha
        const salidasFecha = salidasDetalle.filter(s => 
          s.socio === venta.socio && s.fecha === venta.fecha
        );

        const salidas_muerte = salidasFecha
          .filter(s => s.causa === 'muerte')
          .reduce((sum, s) => sum + s.cantidad, 0);

        const salidas_robo = salidasFecha
          .filter(s => s.causa === 'robo')
          .reduce((sum, s) => sum + s.cantidad, 0);

        // Obtener datos del registro de esa fecha
        const registroFecha = registros.find(r => 
          r.socio === venta.socio && r.fecha === venta.fecha
        );

        if (!registroFecha) continue;

        const vr_kilo_venta = registroFecha.vr_kilo || 0;
        const total_kilos_venta = registroFecha.kg_totales || 0;
        const total_venta = registroFecha.total || 0;

        // Calcular porcentajes
        const porcentaje_60 = total_venta * 0.6;
        const porcentaje_40 = total_venta * 0.4;

        // Calcular inventario actual (total entradas - total salidas hasta la fecha)
        const totalSalidasHastaFecha = registros
          .filter(r => r.socio === venta.socio && r.fecha <= venta.fecha)
          .reduce((sum, r) => sum + (r.salidas || 0), 0);

        const inventario_actual = inventarioTotal - totalSalidasHastaFecha;

        ventasProcessed.push({
          fecha_venta: venta.fecha,
          inventario: inventarioTotal,
          salidas_venta: venta.cantidad_ventas,
          salidas_muerte,
          salidas_robo,
          vr_kilo_venta,
          total_kilos_venta,
          total_venta,
          porcentaje_60,
          porcentaje_40,
          inventario_actual,
          socio: venta.socio
        });
      }

      // Ordenar por fecha descendente
      ventasProcessed.sort((a, b) => new Date(b.fecha_venta).getTime() - new Date(a.fecha_venta).getTime());

      setVentasData(ventasProcessed);
    } catch (error) {
      console.error('Error loading ventas data:', error);
      setError('Error al cargar los datos de ventas');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return `$${Math.round(value).toLocaleString('es-CO')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-7xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 flex items-center">
              <DollarSign className="w-6 h-6 mr-2 text-green-600" />
              Tabla de Ventas
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {socioSeleccionado ? `Ventas de ${socioSeleccionado}` : 'Ventas de todos los socios'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
              <span className="ml-3 text-gray-600">Cargando datos de ventas...</span>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="text-red-600 mb-2">{error}</div>
              <button
                onClick={loadVentasData}
                className="text-emerald-600 hover:text-emerald-700 font-medium"
              >
                Intentar de nuevo
              </button>
            </div>
          ) : ventasData.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No hay ventas registradas
              </h3>
              <p className="text-gray-500">
                {socioSeleccionado 
                  ? `No se encontraron ventas para ${socioSeleccionado}`
                  : 'No se encontraron ventas en el sistema'
                }
              </p>
            </div>
          ) : (
            <div className="overflow-auto max-h-[60vh]">
              <table className="w-full border-collapse">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                      Fecha Venta
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                      Inventario
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                      Salidas Venta
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                      Salidas Muerte
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                      Salidas Robo
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                      Vr/Kilo Venta
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                      Total Kilos
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                      Total Venta
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                      60%
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                      40%
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                      Inventario Actual
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                      Socio
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {ventasData.map((venta, index) => (
                    <tr key={`${venta.socio}-${venta.fecha_venta}-${index}`} className="hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center">
                          <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                          {new Date(venta.fecha_venta + 'T00:00:00').toLocaleDateString('es-CO')}
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 font-medium">
                        {venta.inventario}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-green-600 font-medium">
                        {venta.salidas_venta}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-red-600">
                        {venta.salidas_muerte}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-orange-600">
                        {venta.salidas_robo}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(venta.vr_kilo_venta)}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">
                        {Math.round(venta.total_kilos_venta)} kg
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 font-bold">
                        {formatCurrency(venta.total_venta)}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-blue-600 font-medium">
                        {formatCurrency(venta.porcentaje_60)}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-purple-600 font-medium">
                        {formatCurrency(venta.porcentaje_40)}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 font-medium">
                        <span className={venta.inventario_actual >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {venta.inventario_actual}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 font-medium">
                        <div className="flex items-center">
                          <Users className="w-4 h-4 mr-2 text-gray-400" />
                          {venta.socio}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Total de registros: <span className="font-medium">{ventasData.length}</span>
              </div>
              <button
                onClick={onClose}
                className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesTableModal;