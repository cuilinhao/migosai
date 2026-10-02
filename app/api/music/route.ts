import { createGeneration } from '@/lib/server/generations';
import { api } from '@/lib/server/errors';
export const POST=api(async(request)=>createGeneration(request,'music'));
