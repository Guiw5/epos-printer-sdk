import { DeviceConstructor } from "../types";
const modules = import.meta.glob('../devices/*.ts');

/**
 * Loads a named class from the devices directory.
 * @param name - The name of the class to load.
 * @returns A promise that resolves to the loaded class.
 */
export async function loadNamedClass(name: string): Promise<DeviceConstructor> {
  const path = `../devices/${name}.ts`;

  const loader = modules[path];
  if (!loader) throw new Error(`Clase no encontrada: ${name}`);
  
  const mod = await loader() as Record<string, DeviceConstructor>;
  
  const clazz = mod[name];
  if (!clazz) throw new Error(`No se exportó una clase llamada '${name}' desde ${path}`);

  return clazz;
}