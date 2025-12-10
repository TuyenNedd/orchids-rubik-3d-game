'use client'

import { RubiksCube } from '@/components/RubiksCube'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-800 to-gray-900 text-white">
      <div className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-7xl font-black mb-4 bg-clip-text text-transparent bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 tracking-tight">
            Rubik's Cube 3D
          </h1>
          <p className="text-xl text-gray-300 font-light max-w-2xl mx-auto">
            Drag to rotate the view • Click buttons to rotate layers • Scramble and solve the puzzle
          </p>
        </div>

        <div className="max-w-6xl mx-auto">
          <RubiksCube />
        </div>

        <div className="mt-16 text-center">
          <div className="inline-block bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10">
            <h2 className="text-2xl font-bold mb-4 text-yellow-400">How to Play</h2>
            <div className="grid md:grid-cols-3 gap-6 text-left">
              <div className="space-y-2">
                <div className="text-4xl">🖱️</div>
                <h3 className="font-semibold text-lg">Rotate View</h3>
                <p className="text-gray-400 text-sm">Click and drag to rotate the entire cube view</p>
              </div>
              <div className="space-y-2">
                <div className="text-4xl">🎯</div>
                <h3 className="font-semibold text-lg">Control Layers</h3>
                <p className="text-gray-400 text-sm">Use the colored buttons to rotate individual layers</p>
              </div>
              <div className="space-y-2">
                <div className="text-4xl">🎲</div>
                <h3 className="font-semibold text-lg">Scramble & Reset</h3>
                <p className="text-gray-400 text-sm">Scramble for a challenge or reset to start fresh</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
