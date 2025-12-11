'use client'

import React, { useRef, useState, useMemo, useEffect, forwardRef, useImperativeHandle } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, RoundedBox, Text } from '@react-three/drei'
import * as THREE from 'three'

// Colors based on standard Rubik's cube
const COLORS = {
  U: '#FFFFFF', // Up - White
  D: '#FFD500', // Down - Yellow
  F: '#009E60', // Front - Green
  B: '#0051BA', // Back - Blue
  R: '#C41E3A', // Right - Red
  L: '#FF5800', // Left - Orange
  CORE: '#111111' // Black plastic
}

const ID_TO_COLOR: Record<string, string> = {
  '0': COLORS.R,
  '1': COLORS.L,
  '2': COLORS.U,
  '3': COLORS.D,
  '4': COLORS.F,
  '5': COLORS.B,
}

type CubieProps = {
  position: [number, number, number]
  quaternion?: THREE.Quaternion
  colors: (string | null)[]
  id: number
  onPointerDown?: (e: any) => void
  onPointerMove?: (e: any) => void
  onPointerUp?: (e: any) => void
}

const Cubie = forwardRef<THREE.Group, CubieProps>(({ position, colors, id, onPointerDown, onPointerMove, onPointerUp, quaternion }, ref) => {
  const localRef = useRef<THREE.Group>(null)
  useImperativeHandle(ref, () => localRef.current!)
  const [hovered, setHovered] = useState(false)
  
  // Use a default quaternion if none provided, but we expect one passed from parent
  const defaultQuaternion = useMemo(() => new THREE.Quaternion(), [])

  // Map index to face color based on sticker ID
  const faceColors = colors.map(c => c ? ID_TO_COLOR[c] : null)
  
  const stickerSize = 0.88
  const stickerOffset = 0.51

  return (
    <group
      ref={localRef}
      position={position}
      quaternion={quaternion || defaultQuaternion}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true) }}
      onPointerOut={(e) => { e.stopPropagation(); setHovered(false) }}
    >
      {/* Black plastic core */}
      <RoundedBox args={[1, 1, 1]} radius={0.1} smoothness={4}>
        <meshStandardMaterial color={COLORS.CORE} roughness={0.6} metalness={0.1} />
      </RoundedBox>

      {/* Stickers */}
      {faceColors.map((color, i) => {
        if (!color) return null
        
        const pos: [number, number, number] = [0, 0, 0]
        const rot: [number, number, number] = [0, 0, 0]
        
        if (i === 0) { pos[0] = stickerOffset; rot[1] = Math.PI / 2 }
        else if (i === 1) { pos[0] = -stickerOffset; rot[1] = -Math.PI / 2 }
        else if (i === 2) { pos[1] = stickerOffset; rot[0] = -Math.PI / 2 }
        else if (i === 3) { pos[1] = -stickerOffset; rot[0] = Math.PI / 2 }
        else if (i === 4) { pos[2] = stickerOffset; }
        else if (i === 5) { pos[2] = -stickerOffset; rot[1] = Math.PI }

        // Check for center logo condition:
        // 1. Color is White (COLORS.U)
        // 2. This cubie only has ONE sticker (it is a center piece)
        const isCenterPiece = colors.filter(c => c).length === 1

        return (
          <group key={i} position={pos} rotation={rot}>
             <RoundedBox args={[stickerSize, stickerSize, 0.02]} radius={0.05} smoothness={4}>
                <meshStandardMaterial color={color} roughness={0.2} metalness={0.0} polygonOffset polygonOffsetFactor={-1} />
             </RoundedBox>
             {/* Logo on White Center */}
             {color === COLORS.U && isCenterPiece && (
                <Text
                  position={[0, 0, 0.03]}
                  fontSize={0.25}
                  color="black"
                  anchorX="center"
                  anchorY="middle"
                  rotation={[0, 0, 0]}
                >
                  RUBIKS{'\n'}CUBE
                </Text>
             )}
          </group>
        )
      })}
    </group>
  )
})
Cubie.displayName = 'Cubie'

type CubeState = {
  position: [number, number, number]
  colors: (string | null)[]
}

type Move = {
  axis: 'x' | 'y' | 'z'
  layer: number
  dir: 1 | -1
}

type SceneProps = {
  cubeState: CubeState[]
  setCubeState: React.Dispatch<React.SetStateAction<CubeState[]>>
  moveQueue: React.MutableRefObject<Move[]>
}

function Scene({ cubeState, setCubeState, moveQueue }: SceneProps) {
  const { camera, gl } = useThree()
  const cubieRefs = useRef<(THREE.Group | null)[]>([])
  const isAnimating = useRef(false)
  const animationProgress = useRef(0)
  const currentMove = useRef<Move | null>(null)
  const prevAngle = useRef(0)
  const orbitControlsRef = useRef<any>(null)
  
  // Create a new identity quaternion every render to force prop updates on Cubies
  // This ensures that after an animation (where the THREE object was manually rotated),
  // the rotation is strictly reset to 0 when the React state updates.
  const identityQuaternion = new THREE.Quaternion()
  
  // Interaction refs
  const interactionRef = useRef({
    active: false,
    startPoint: new THREE.Vector3(),
    normal: new THREE.Vector3(),
    intersectedCubieIndex: -1
  })

  // Debug: Log when cubeState changes
  useEffect(() => {
    // console.log('Cube State Updated', cubeState[0].position, cubeState[0].colors)
  }, [cubeState])

  // Animation Loop
  useFrame((state, delta) => {
    // Handle Animation
    if (isAnimating.current && currentMove.current) {
      const speed = 4.0 // Animation speed
      animationProgress.current += delta * speed
      
      if (animationProgress.current >= 1) {
        animationProgress.current = 1
      }

      // Easing - EaseInOutCubic for smoothness
      const t = animationProgress.current
      const easedT = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
      const currentAngle = easedT * (Math.PI / 2) * currentMove.current.dir
      
      const deltaAngle = currentAngle - prevAngle.current
      
      // Apply rotation to active cubies
      const { axis, layer } = currentMove.current
      const axisVec = new THREE.Vector3(
        axis === 'x' ? 1 : 0,
        axis === 'y' ? 1 : 0,
        axis === 'z' ? 1 : 0
      )

      cubieRefs.current.forEach((ref, i) => {
        if (!ref) return
        const logicalPos = cubeState[i].position
        // Check if cubie is in the moving layer
        const layerCoord = logicalPos[axis === 'x' ? 0 : axis === 'y' ? 1 : 2]
        if (Math.abs(layerCoord - layer * 1.05) < 0.1) {
           ref.position.applyAxisAngle(axisVec, deltaAngle)
           ref.rotateOnWorldAxis(axisVec, deltaAngle)
        }
      })

      prevAngle.current = currentAngle

      if (animationProgress.current >= 1) {
        // Animation Complete
        isAnimating.current = false
        finishMove(currentMove.current)
        currentMove.current = null
      }
    } else if (moveQueue.current.length > 0) {
      // Start Next Move
      const nextMove = moveQueue.current.shift()!
      currentMove.current = nextMove
      isAnimating.current = true
      animationProgress.current = 0
      prevAngle.current = 0
    }
  })

  const finishMove = (move: Move) => {
    const { axis, layer, dir } = move
    
    // Update Logical State
    // We do NOT manually reset the THREE objects here anymore.
    // We rely on React to re-render the Scene with the new cubeState.
    // Since we pass a fresh identityQuaternion to Cubie, Three-fiber will reset the rotation to 0.
    // The visual transition from "Rotated State" to "New Position + 0 Rotation" should be seamless.
    
    setCubeState(prev => {
      const newState = prev.map(c => ({ 
          ...c,
          position: [...c.position] as [number, number, number],
          colors: [...c.colors]
      }))
      
      const indicesToRotate = newState.map((c, i) => i).filter(i => {
         const pos = newState[i].position
         return Math.abs(pos[axis === 'x' ? 0 : axis === 'y' ? 1 : 2] - layer * 1.05) < 0.1
      })

      // console.log(`Finishing move: ${axis} ${layer} ${dir}. Rotating ${indicesToRotate.length} cubies.`)

      indicesToRotate.forEach(i => {
        const cube = newState[i]
        const [x, y, z] = cube.position
        
        let newPos: [number, number, number] = [...cube.position]
        
        if (axis === 'x') {
           if (dir === 1) {
             newPos = [x, -z, y]
             const [c0, c1, c2, c3, c4, c5] = cube.colors
             cube.colors = [c0, c1, c5, c4, c2, c3]
           } else {
             newPos = [x, z, -y]
             const [c0, c1, c2, c3, c4, c5] = cube.colors
             cube.colors = [c0, c1, c4, c5, c3, c2]
           }
        } else if (axis === 'y') {
           if (dir === 1) {
             newPos = [z, y, -x]
             const [c0, c1, c2, c3, c4, c5] = cube.colors
             cube.colors = [c4, c5, c2, c3, c1, c0] 
           } else {
             newPos = [-z, y, x]
             const [c0, c1, c2, c3, c4, c5] = cube.colors
             cube.colors = [c5, c4, c2, c3, c0, c1]
           }
        } else {
           if (dir === 1) {
             newPos = [-y, x, z]
             const [c0, c1, c2, c3, c4, c5] = cube.colors
             cube.colors = [c3, c2, c0, c1, c4, c5]
           } else {
             newPos = [y, -x, z]
             const [c0, c1, c2, c3, c4, c5] = cube.colors
             cube.colors = [c2, c3, c1, c0, c4, c5]
           }
        }
        
        // Check for NaN positions
        if (isNaN(newPos[0]) || isNaN(newPos[1]) || isNaN(newPos[2])) {
            console.error('NaN position detected!', cube.position, newPos)
        }

        cube.position = [
          Math.round(newPos[0] * 100) / 100,
          Math.round(newPos[1] * 100) / 100,
          Math.round(newPos[2] * 100) / 100
        ]
      })

      return newState
    })
  }

  const queueMove = (axis: 'x' | 'y' | 'z', layer: number, dir: 1 | -1) => {
    moveQueue.current.push({ axis, layer, dir })
  }

  // Interaction Handlers
  const handlePointerDown = (e: any, index: number) => {
    e.stopPropagation()
    // Disable controls only if we hit a cube
    if (orbitControlsRef.current) orbitControlsRef.current.enabled = false
    
    // Get World Normal
    const normal = e.face.normal.clone()
    normal.transformDirection(e.object.matrixWorld)
    
    const startPoint = e.point.clone()
    
    // Store initial state for the drag
    interactionRef.current = {
      active: true,
      startPoint: startPoint,
      normal: normal,
      intersectedCubieIndex: index
    }

    // Define global handlers to track drag outside canvas
    const handleGlobalMove = (event: PointerEvent) => {
        if (!interactionRef.current.active) return
        
        // Calculate Normalized Device Coordinates (NDC)
        const rect = gl.domElement.getBoundingClientRect()
        const x = ((event.clientX - rect.left) / rect.width) * 2 - 1
        const y = -((event.clientY - rect.top) / rect.height) * 2 + 1
        const currentNDC = new THREE.Vector2(x, y)
        
        // Project start point to NDC
        const startPointNDC = interactionRef.current.startPoint.clone().project(camera)
        const startNDC = new THREE.Vector2(startPointNDC.x, startPointNDC.y)
        
        const dragVec = currentNDC.clone().sub(startNDC)
        const dist = dragVec.length()

        // Threshold for move detection (NDC space)
        if (dist > 0.05) {
          const normal = interactionRef.current.normal
          const absNormal = new THREE.Vector3(Math.abs(normal.x), Math.abs(normal.y), Math.abs(normal.z))
          
          let moveAxis: 'x' | 'y' | 'z' | null = null
          let moveDir: 1 | -1 = 1
          let layer = 0
          
          // Re-access state
          const index = interactionRef.current.intersectedCubieIndex
          const cube = cubeState[index]
          
          // Helper to determine axis dominance in screen space
          const checkAxes = (
            axis1: THREE.Vector3, axis1Name: 'x' | 'y' | 'z', 
            axis2: THREE.Vector3, axis2Name: 'x' | 'y' | 'z'
          ) => {
             // Project World Axes to Screen Space
             const p1 = interactionRef.current.startPoint.clone().add(axis1).project(camera)
             const v1 = new THREE.Vector2(p1.x, p1.y).sub(startNDC).normalize()
             const dot1 = dragVec.clone().normalize().dot(v1)
             
             const p2 = interactionRef.current.startPoint.clone().add(axis2).project(camera)
             const v2 = new THREE.Vector2(p2.x, p2.y).sub(startNDC).normalize()
             const dot2 = dragVec.clone().normalize().dot(v2)
             
             if (Math.abs(dot1) > Math.abs(dot2)) {
                 return { axis: axis1Name, dot: dot1 }
             } else {
                 return { axis: axis2Name, dot: dot2 }
             }
          }
          
          if (absNormal.x > 0.8) { 
             // Right/Left Face
             // Tangents: Y (0,1,0) and Z (0,0,1)
             const result = checkAxes(new THREE.Vector3(0,1,0), 'y', new THREE.Vector3(0,0,1), 'z')
             
             if (result.axis === 'y') {
                // Dragging along World Y -> Rotate X (Face Rotation)
                moveAxis = 'x'
                layer = Math.round(cube.position[0] / 1.05)
                
                const zSign = Math.sign(interactionRef.current.startPoint.z) || 1
                const dragDir = Math.sign(result.dot)
                moveDir = (dragDir === 1 ? -1 : 1) * zSign as 1 | -1
             } else {
                // Dragging along World Z -> Rotate Y (Slice Rotation)
                moveAxis = 'y'
                layer = Math.round(cube.position[1] / 1.05)
                
                const sign = Math.sign(normal.x)
                const dragDir = Math.sign(result.dot)
                moveDir = (dragDir === 1 ? -1 : 1) * sign as 1 | -1
             }
             
          } else if (absNormal.y > 0.8) {
             // Top/Bottom Face
             // Tangents: X (1,0,0) and Z (0,0,1)
             const result = checkAxes(new THREE.Vector3(1,0,0), 'x', new THREE.Vector3(0,0,1), 'z')
             
             if (result.axis === 'x') {
                // Dragging along World X -> Rotate Z
                moveAxis = 'z'
                layer = Math.round(cube.position[2] / 1.05)
                
                const sign = Math.sign(normal.y)
                const dragDir = Math.sign(result.dot)
                moveDir = (dragDir === 1 ? -1 : 1) * sign as 1 | -1
             } else {
                // Dragging along World Z -> Rotate X
                moveAxis = 'x'
                layer = Math.round(cube.position[0] / 1.05)
                
                const sign = Math.sign(normal.y)
                const dragDir = Math.sign(result.dot)
                moveDir = (dragDir === 1 ? 1 : -1) * sign as 1 | -1
             }

          } else {
             // Front/Back Face
             // Tangents: X (1,0,0) and Y (0,1,0)
             const result = checkAxes(new THREE.Vector3(1,0,0), 'x', new THREE.Vector3(0,1,0), 'y')
             
             if (result.axis === 'x') {
                // Dragging along World X -> Rotate Y
                moveAxis = 'y'
                layer = Math.round(cube.position[1] / 1.05)
                
                const sign = Math.sign(normal.z)
                const dragDir = Math.sign(result.dot)
                moveDir = (dragDir === 1 ? 1 : -1) * sign as 1 | -1
             } else {
                // Dragging along World Y -> Rotate X
                moveAxis = 'x'
                layer = Math.round(cube.position[0] / 1.05)
                
                const sign = Math.sign(normal.z)
                const dragDir = Math.sign(result.dot)
                moveDir = (dragDir === 1 ? -1 : 1) * sign as 1 | -1
             }
          }

          if (moveAxis) {
              console.log('Queueing move:', moveAxis, layer, moveDir)
              queueMove(moveAxis, layer, moveDir)
          }
          
          // Finish interaction
          cleanup()
        }
    }
    
    const handleGlobalUp = () => {
        cleanup()
    }
    
    const cleanup = () => {
        interactionRef.current.active = false
        if (orbitControlsRef.current) orbitControlsRef.current.enabled = true
        window.removeEventListener('pointermove', handleGlobalMove)
        window.removeEventListener('pointerup', handleGlobalUp)
    }
    
    window.addEventListener('pointermove', handleGlobalMove)
    window.addEventListener('pointerup', handleGlobalUp)
  }

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 10, 5]} intensity={1.2} />
      <directionalLight position={[-10, -10, -5]} intensity={0.5} />
      
      <group>
         {cubeState.map((cube, i) => (
            <Cubie
              key={i}
              id={i}
              ref={el => { cubieRefs.current[i] = el }}
              position={cube.position}
              colors={cube.colors}
              onPointerDown={(e) => handlePointerDown(e, i)}
              quaternion={identityQuaternion}
            />
         ))}
      </group>
      
      <OrbitControls
        ref={orbitControlsRef}
        enablePan={false}
        minDistance={4}
        maxDistance={12}
        enableDamping
        dampingFactor={0.05}
      />
    </>
  )
}

function Game() {
  const [resetKey, setResetKey] = useState(0) // Key to force Scene remount
  const [cubeState, setCubeState] = useState<CubeState[]>(() => {
    const initialState: CubeState[] = []
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          const colors: (string | null)[] = [
            x === 1 ? '0' : null,
            x === -1 ? '1' : null,
            y === 1 ? '2' : null,
            y === -1 ? '3' : null,
            z === 1 ? '4' : null,
            z === -1 ? '5' : null,
          ]
          initialState.push({ position: [x * 1.05, y * 1.05, z * 1.05], colors })
        }
      }
    }
    return initialState
  })

  const moveQueue = useRef<Move[]>([])

  const queueMove = (axis: 'x' | 'y' | 'z', layer: number, dir: 1 | -1) => {
    moveQueue.current.push({ axis, layer, dir })
  }

  const scramble = () => {
    const axes: ('x' | 'y' | 'z')[] = ['x', 'y', 'z']
    const layers = [-1, 0, 1]
    const dirs: (1 | -1)[] = [1, -1]
    
    for (let i = 0; i < 20; i++) {
        const randomAxis = axes[Math.floor(Math.random() * axes.length)]
        const randomLayer = layers[Math.floor(Math.random() * layers.length)]
        const randomDir = dirs[Math.floor(Math.random() * dirs.length)]
        moveQueue.current.push({ axis: randomAxis, layer: randomLayer, dir: randomDir })
    }
  }

  const reset = () => {
    moveQueue.current = []
    setResetKey(prev => prev + 1) // Force Scene remount
    
    const initialState: CubeState[] = []
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          const colors: (string | null)[] = [
            x === 1 ? '0' : null,
            x === -1 ? '1' : null,
            y === 1 ? '2' : null,
            y === -1 ? '3' : null,
            z === 1 ? '4' : null,
            z === -1 ? '5' : null,
          ]
          initialState.push({ position: [x * 1.05, y * 1.05, z * 1.05], colors })
        }
      }
    }
    setCubeState(initialState)
  }

  return (
    <div className="w-full h-full flex flex-col gap-6">
      <div className="w-full h-[600px] bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 rounded-2xl shadow-2xl overflow-hidden relative">
        <Canvas camera={{ position: [5, 5, 5], fov: 45 }}>
          <Scene key={resetKey} cubeState={cubeState} setCubeState={setCubeState} moveQueue={moveQueue} />
        </Canvas>
        
        {/* Instructions Overlay */}
        <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-md p-4 rounded-xl text-white/80 text-sm pointer-events-none select-none">
           <p className="font-bold mb-1">Controls:</p>
           <ul className="list-disc pl-4 space-y-1">
             <li>Drag on cube to rotate layers</li>
             <li>Drag background to rotate view</li>
           </ul>
        </div>
      </div>

      <div className="flex gap-4 justify-center flex-wrap">
        <button onClick={() => queueMove('x', -1, 1)} className="btn bg-red-600">L</button>
        <button onClick={() => queueMove('x', -1, -1)} className="btn bg-red-600">L'</button>
        <button onClick={() => queueMove('x', 1, 1)} className="btn bg-red-600">R</button>
        <button onClick={() => queueMove('x', 1, -1)} className="btn bg-red-600">R'</button>
        
        <button onClick={() => queueMove('y', 1, 1)} className="btn bg-blue-600">U</button>
        <button onClick={() => queueMove('y', 1, -1)} className="btn bg-blue-600">U'</button>
        <button onClick={() => queueMove('y', -1, 1)} className="btn bg-blue-600">D</button>
        <button onClick={() => queueMove('y', -1, -1)} className="btn bg-blue-600">D'</button>
        
        <button onClick={() => queueMove('z', 1, 1)} className="btn bg-green-600">F</button>
        <button onClick={() => queueMove('z', 1, -1)} className="btn bg-green-600">F'</button>
        <button onClick={() => queueMove('z', -1, 1)} className="btn bg-green-600">B</button>
        <button onClick={() => queueMove('z', -1, -1)} className="btn bg-green-600">B'</button>

        <button onClick={scramble} className="btn bg-yellow-600 font-bold px-6">Scramble</button>
        <button onClick={reset} className="btn bg-purple-600 font-bold px-6">Reset</button>
      </div>
      
      <style jsx>{`
        .btn {
          padding: 0.5rem 1rem;
          color: white;
          border-radius: 0.5rem;
          font-weight: 600;
          transition: all 0.2s;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        .btn:hover {
          transform: translateY(-2px);
          filter: brightness(110%);
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2);
        }
        .btn:active {
          transform: translateY(0);
        }
      `}</style>
    </div>
  )
}

export const RubiksCube = Game