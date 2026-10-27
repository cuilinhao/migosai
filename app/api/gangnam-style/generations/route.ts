import { createGangnamStyleGeneration } from '@/lib/server/gangnam-style';
import { api } from '@/lib/server/errors';
export const POST = api(createGangnamStyleGeneration);
