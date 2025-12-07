import { ArrowFunction, FunctionExpression, MethodDeclaration, Node, SourceFile, SyntaxKind } from 'ts-morph'
import { RouteInfo } from './types'

/**
 * Extract route information from an object literal containing route handlers
 */
export function extractRoutesFromObjectLiteral(objLiteral: Node, filePath: string): RouteInfo[] {
  if (!Node.isObjectLiteralExpression(objLiteral)) return []

  const fileRoutes: RouteInfo[] = []

  objLiteral.getProperties().forEach(prop => {
    let routePath: string
    let functionNode: ArrowFunction | FunctionExpression | MethodDeclaration | undefined

    // handle method shorthand: foo() {}
    if (Node.isMethodDeclaration(prop)) {
      routePath = prop.getName()
      functionNode = prop
    }
    // handle property assignment: foo: () => {} or foo: function() {}
    else if (Node.isPropertyAssignment(prop)) {
      routePath = prop.getName()
      const initializer = prop.getInitializer()

      if (!initializer || (!Node.isArrowFunction(initializer) && !Node.isFunctionExpression(initializer))) {
        console.log(`⏭️ Skipping non-function property: ${routePath}`)
        return
      }

      functionNode = initializer
    }
    // handle spread: ...otherRoutes (we'll skip these in initial extraction)
    else if (Node.isSpreadAssignment(prop)) {
      return
    }
    else {
      return
    }

    if (!functionNode) return

    // normalize path by removing quotes if present
    routePath = routePath.replace(/^['"]|['"]$/g, '')

    // get parameter type
    const params = functionNode.getParameters()
    const paramText = params.length > 0
      ? params[0].getText()
      : ''

    // get return type
    const returnType = functionNode.getReturnType().getText()

    const info: RouteInfo = {
      path: routePath,
      file: filePath,
      paramText,
      returnType
    }

    console.log(`  ✅ Found route: ${routePath}`)
    fileRoutes.push(info)
  })

  return fileRoutes
}

/**
 * Resolve a node to an object literal, handling variables, function calls, and property access
 */
export function resolveVariableToObjectLiteral(node: Node, sourceFile: SourceFile): Node | undefined {
  const visited = new Set<string>()

  function resolve(current: Node): Node | undefined {
    const nodeText = current.getText()

    // prevent infinite recursion
    if (visited.has(nodeText)) return undefined
    visited.add(nodeText)

    // direct object literal
    if (Node.isObjectLiteralExpression(current)) {
      return current
    }

    // variable reference
    if (Node.isIdentifier(current)) {
      return resolveIdentifier(current, sourceFile, visited)
    }

    // function call (like defineMessageRoutes(...))
    if (Node.isCallExpression(current)) {
      return resolveFunctionCall(current, sourceFile, visited)
    }

    // property access (like obj.routes)
    if (Node.isPropertyAccessExpression(current)) {
      return resolvePropertyAccess(current, sourceFile, visited)
    }

    return undefined
  }

  return resolve(node)
}

/**
 * Resolve an identifier to its definition
 */
function resolveIdentifier(identifier: Node, sourceFile: SourceFile, visited: Set<string>): Node | undefined {
  if (!Node.isIdentifier(identifier)) return undefined

  const varName = identifier.getText()

  // look up variable declaration
  const variableDeclarations = sourceFile.getVariableDeclarations()
  for (const declaration of variableDeclarations) {
    if (declaration.getName() === varName) {
      const initializer = declaration.getInitializer()
      if (initializer) {
        return resolveNodeRecursively(initializer, sourceFile, visited)
      }
    }
  }

  // look for function declarations that return routes
  const functionDeclarations = sourceFile.getFunctions()
  for (const func of functionDeclarations) {
    if (func.getName() === varName) {
      const returnStatements = func.getDescendantsOfKind(SyntaxKind.ReturnStatement)
      for (const returnStmt of returnStatements) {
        const returnExpr = returnStmt.getExpression()
        if (returnExpr) {
          const resolved = resolveNodeRecursively(returnExpr, sourceFile, visited)
          if (resolved) return resolved
        }
      }
    }
  }

  return undefined
}

/**
 * Resolve a function call to its result
 */
function resolveFunctionCall(callExpr: Node, sourceFile: SourceFile, visited: Set<string>): Node | undefined {
  if (!Node.isCallExpression(callExpr)) return undefined

  const expression = callExpr.getExpression()
  const args = callExpr.getArguments()

  // known wrapper functions (defineMessageRoutes, etc.)
  if (Node.isIdentifier(expression)) {
    const funcName = expression.getText()

    // these functions just return their first argument
    if (funcName === 'defineMessageRoutes' || funcName === 'Object.assign' || funcName === 'merge') {
      if (args.length > 0) {
        return resolveNodeRecursively(args[0], sourceFile, visited)
      }
    }
  }

  // try to resolve the function and find its return value
  if (Node.isIdentifier(expression)) {
    const funcName = expression.getText()
    const functionDeclarations = sourceFile.getFunctions()

    for (const func of functionDeclarations) {
      if (func.getName() === funcName) {
        const returnStatements = func.getDescendantsOfKind(SyntaxKind.ReturnStatement)
        for (const returnStmt of returnStatements) {
          const returnExpr = returnStmt.getExpression()
          if (returnExpr) {
            const resolved = resolveNodeRecursively(returnExpr, sourceFile, visited)
            if (resolved) return resolved
          }
        }
      }
    }
  }

  return undefined
}

/**
 * Resolve property access (like obj.routes)
 */
function resolvePropertyAccess(propAccess: Node, sourceFile: SourceFile, visited: Set<string>): Node | undefined {
  if (!Node.isPropertyAccessExpression(propAccess)) return undefined

  const object = propAccess.getExpression()
  const propertyName = propAccess.getName()

  const resolvedObject = resolveNodeRecursively(object, sourceFile, visited)

  if (resolvedObject && Node.isObjectLiteralExpression(resolvedObject)) {
    const property = resolvedObject.getProperty(propertyName)

    if (property && Node.isPropertyAssignment(property)) {
      const initializer = property.getInitializer()
      if (initializer) {
        return resolveNodeRecursively(initializer, sourceFile, visited)
      }
    }
  }

  return undefined
}

/**
 * Main recursive resolution function
 */
function resolveNodeRecursively(node: Node, sourceFile: SourceFile, visited: Set<string>): Node | undefined {
  const nodeText = node.getText()

  if (visited.has(nodeText)) return undefined
  visited.add(nodeText)

  if (Node.isObjectLiteralExpression(node)) return node
  if (Node.isIdentifier(node)) return resolveIdentifier(node, sourceFile, visited)
  if (Node.isCallExpression(node)) return resolveFunctionCall(node, sourceFile, visited)
  if (Node.isPropertyAccessExpression(node)) return resolvePropertyAccess(node, sourceFile, visited)

  return undefined
}

/**
 * Extract routes from an object that may contain spreads
 */
export function extractRoutesWithSpreads(objLiteral: Node, sourceFile: SourceFile, filePath: string): RouteInfo[] {
  if (!Node.isObjectLiteralExpression(objLiteral)) return []

  const allRoutes: RouteInfo[] = []
  const visited = new Set<string>()

  function extractFromObject(obj: Node) {
    if (!Node.isObjectLiteralExpression(obj)) return
    if (visited.has(obj.getText())) return
    visited.add(obj.getText())

    obj.getProperties().forEach(prop => {
      // handle spread
      if (Node.isSpreadAssignment(prop)) {
        const spreadExpr = prop.getExpression()
        const resolved = resolveVariableToObjectLiteral(spreadExpr, sourceFile)
        if (resolved) {
          extractFromObject(resolved)
        }
      }
      // regular properties will be extracted normally
    })

    // extract routes from this object
    const routes = extractRoutesFromObjectLiteral(obj, filePath)
    allRoutes.push(...routes)
  }

  extractFromObject(objLiteral)
  return allRoutes
}
