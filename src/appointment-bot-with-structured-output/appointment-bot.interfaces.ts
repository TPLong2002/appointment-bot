export interface Doctor {
  id: string;
  name: string;
  departmentId: string;
  departmentName?: string; // Thêm trường tùy chọn departmentName
  specialization: string;
  experience: string;
  availability: string[];
}

export interface Appointment {
  id: string;
  patientName: string;
  phoneNumber: string;
  appointmentDate: string;
  appointmentTime: string;
  symptoms: string;
  departmentId: string;
  departmentName: string;
  doctorId: string;
  doctorName: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  createdAt: string;
  confirmationDate?: string;
}

export interface DiagnosisResult {
  recommendedDept: string;
  alternativeDept?: string;
  description: string;
}
