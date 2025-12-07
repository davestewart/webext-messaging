export interface RouteInfo {
  path: string
  file: string
  paramText: string
  returnType: string
}

export interface RouterDefinition {
  group: string | null
  routes: RouteInfo[]
  file: string
  routesSource: string
}
