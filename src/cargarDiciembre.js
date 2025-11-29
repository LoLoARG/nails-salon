import { db } from './firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';

// Horarios ocupados por día (solo los que tienen 🌸)
const horariosOcupados = {
  '2025-12-05': ['10:00'],
  '2025-12-09': ['10:00'],
  '2025-12-13': ['16:00'],
  '2025-12-20': ['14:00', '16:00'],
  '2025-12-23': ['16:00'],
  '2025-12-24': ['10:00'],
  '2025-12-30': ['10:00']
};

// Días que NO trabaja (bloquear completos)
const diasNoLaborables = [
  '2025-12-25',
  '2025-12-27',
  '2025-12-28'
];

export async function cargarHorariosDiciembre() {
  try {
    console.log('🔄 Cargando horarios de diciembre 2025...');
    
    let contador = 0;
    
    // 1. Bloquear horarios específicos ocupados
    for (const [fecha, horas] of Object.entries(horariosOcupados)) {
      for (const hora of horas) {
        await addDoc(collection(db, 'horarios_bloqueados'), {
          tipo: 'horario_especifico',
          fecha: fecha,
          hora: hora,
          motivo: 'Turno ocupado',
          createdAt: Timestamp.now()
        });
        contador++;
        console.log(`✅ Bloqueado: ${fecha} a las ${hora}`);
      }
    }
    
    // 2. Bloquear días completos no laborables
    for (const fecha of diasNoLaborables) {
      await addDoc(collection(db, 'horarios_bloqueados'), {
        tipo: 'dia_completo',
        fecha: fecha,
        motivo: 'Día no laborable',
        createdAt: Timestamp.now()
      });
      contador++;
      console.log(`✅ Día completo bloqueado: ${fecha}`);
    }
    
    console.log(`🎉 ¡${contador} horarios de diciembre cargados exitosamente!`);
    alert(`✅ ${contador} horarios de diciembre cargados correctamente`);
    
  } catch (error) {
    console.error('❌ Error al cargar horarios:', error);
    alert('Error al cargar horarios: ' + error.message);
  }
}