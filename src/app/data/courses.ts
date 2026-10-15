import type { Course } from "../models/Course";
import { COURSES as catalog } from "../../../shared/courses.mjs";

export const COURSES: Course[] = catalog as Course[];
