/** Router basename for the Vite base path: "/" → "", "/MyVehicleSpend/" → "/MyVehicleSpend". */
export function routerBasename(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}
