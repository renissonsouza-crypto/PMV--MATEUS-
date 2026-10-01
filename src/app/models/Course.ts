export interface Course {
  id: number;
  title: string;
  category: string;
  categoryColor: string;
  modality: "Online" | "Presencial" | "Híbrido";
  hours: number;
  level: "Iniciante" | "Intermediário" | "Avançado" | "Todos os níveis";
  provider: string;
  location: string;
  description: string;
  enrolled: number;
  status: "open" | "last-spots" | "coming-soon";
  period: "Diurno" | "Vespertino" | "Noturno" | "Flexível";
  targetAudience: string[];
  avgSalary: string;
  image: string;
  bgColor: string;
  featured?: number;
  whatYouLearn: string[];
  about: string;
  duration: string;
}
