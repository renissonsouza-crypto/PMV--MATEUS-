export interface Testimonial {
  id: number;
  name: string;
  role: string;
  courseId: number;
  course: string;
  quote: string;
  rating: number;
  illustrative?: boolean;
}
