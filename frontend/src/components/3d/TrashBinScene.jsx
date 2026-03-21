import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows, Float, Instances, Instance, Text } from '@react-three/drei';
import * as THREE from 'three';

function TrashBin() {
    const group = useRef();

    const materials = useMemo(() => ({
        plastic: new THREE.MeshPhysicalMaterial({
            color: '#2a4d14',
            roughness: 0.6,
            metalness: 0.1,
            clearcoat: 0.3,
            clearcoatRoughness: 0.4
        }),
        darkPlastic: new THREE.MeshPhysicalMaterial({
            color: '#1a330a',
            roughness: 0.7,
            metalness: 0.1
        }),
        rubber: new THREE.MeshStandardMaterial({
            color: '#111111',
            roughness: 0.9,
            metalness: 0.1
        }),
        metal: new THREE.MeshStandardMaterial({
            color: '#777777',
            roughness: 0.4,
            metalness: 0.8
        }),
    }), []);

    //  PERFORMANCE 2: Re-use geometry for instancing
    const ridgeGeo = useMemo(() => new THREE.BoxGeometry(0.06, 2.5, 0.06), []);

    useFrame((state) => {
        if (group.current) {
            // Gentle floating rotation
            group.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.1;
        }
    });

    return (
        <group ref={group} dispose={null} position={[0, -1.5, 0]} scale={1.2}>
            {/* Main Body */}
            <mesh position={[0, 1.5, 0]} material={materials.plastic} castShadow receiveShadow>
                <cylinderGeometry args={[1.1, 0.8, 3, 32]} />
            </mesh>

            {/* Text "safabin" */}
            <Text
                position={[0, 1.5, 0.96]}
                rotation={[-Math.atan(0.1), 0, 0]}
                fontSize={0.35}
                color="white"
                anchorX="center"
                anchorY="middle"
                fontWeight="bold"
            >
                safabin
            </Text>

            {/* Rim */}
            <mesh position={[0, 3, 0]} material={materials.darkPlastic} castShadow receiveShadow>
                <torusGeometry args={[1.15, 0.1, 16, 32]} />
            </mesh>

            {/*  REALISM: Front Handle for pulling the bin */}
            <group position={[0, 2.8, 1.15]}>
                <mesh rotation={[Math.PI / 2, 0, 0]} material={materials.darkPlastic} castShadow>
                    <cylinderGeometry args={[0.05, 0.05, 0.6, 16]} />
                </mesh>
                <mesh position={[-0.3, 0.1, 0]} material={materials.darkPlastic} castShadow>
                    <boxGeometry args={[0.05, 0.2, 0.1]} />
                </mesh>
                <mesh position={[0.3, 0.1, 0]} material={materials.darkPlastic} castShadow>
                    <boxGeometry args={[0.05, 0.2, 0.1]} />
                </mesh>
            </group>

            {/*  REALISM: Back Hinge */}
            <mesh position={[0, 3.1, -1.15]} rotation={[0, 0, Math.PI / 2]} material={materials.darkPlastic} castShadow>
                <cylinderGeometry args={[0.08, 0.08, 0.8, 16]} />
            </mesh>

            {/* Lid */}
            <mesh position={[0, 3.2, -1.1]} rotation={[-0.15, 0, 0]} material={materials.plastic} castShadow receiveShadow>
                <group position={[0, 0, 1.1]}>
                    <mesh position={[0, 0, 0]} material={materials.plastic}>
                        <cylinderGeometry args={[1.18, 1.18, 0.1, 32]} />
                    </mesh>
                    {/*  REALISM: Raised center bump on the lid */}
                    <mesh position={[0, 0.05, 0]} material={materials.plastic}>
                        <cylinderGeometry args={[0.8, 1.1, 0.1, 32]} />
                    </mesh>
                    {/* Lid Handle */}
                    <mesh position={[0, 0.15, 0.8]} material={materials.darkPlastic} castShadow>
                        <boxGeometry args={[0.6, 0.1, 0.1]} />
                    </mesh>
                </group>
            </mesh>

            {/* Wheels */}
            <mesh position={[-0.6, 0.2, -0.6]} rotation={[0, 0, Math.PI / 2]} material={materials.rubber} castShadow receiveShadow>
                <cylinderGeometry args={[0.3, 0.3, 0.15, 32]} />
            </mesh>
            <mesh position={[0.6, 0.2, -0.6]} rotation={[0, 0, Math.PI / 2]} material={materials.rubber} castShadow receiveShadow>
                <cylinderGeometry args={[0.3, 0.3, 0.15, 32]} />
            </mesh>

            {/* Wheel Axle */}
            <mesh position={[0, 0.2, -0.6]} rotation={[0, 0, Math.PI / 2]} material={materials.metal} castShadow receiveShadow>
                <cylinderGeometry args={[0.05, 0.05, 1.4, 16]} />
            </mesh>

            {/* Instead of rendering 16 separate boxes (16 draw calls), we render ONE InstancedMesh (1 draw call) */}
            <Instances geometry={ridgeGeo} material={materials.darkPlastic} castShadow receiveShadow>
                {Array.from({ length: 16 }).map((_, i) => {
                    const angle = (i / 16) * Math.PI * 2;
                    // Skip ridges at the front (around PI/2) to make room for text
                    if (angle > Math.PI * 0.35 && angle < Math.PI * 0.65) return null;
                    // Skip ridges at the back (around 1.5 * PI) for the hinge
                    if (angle > Math.PI * 1.35 && angle < Math.PI * 1.65) return null;

                    return (
                        <Instance
                            key={i}
                            position={[
                                Math.cos(angle) * 0.98,
                                1.5,
                                Math.sin(angle) * 0.98,
                            ]}
                            rotation={[0, -angle, 0]}
                        />
                    );
                })}
            </Instances>
        </group>
    );
}

export default function TrashBinScene() {
    return (
        <div className="w-full h-full cursor-grab active:cursor-grabbing">
            {/*  PERFORMANCE 4: dpr={[1, 2]} limits pixel ratio on high-res screens to save GPU */}
            {/*  REALISM: Added 'shadows' prop to enable actual light casting */}
            <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 2, 8], fov: 45 }}>
                <ambientLight intensity={0.6} />
                <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1.5} castShadow shadow-mapSize={[1024, 1024]} />
                <pointLight position={[-10, -10, -10]} intensity={0.5} />

                <Float speed={2.5} rotationIntensity={0.5} floatIntensity={1.5}>
                    <TrashBin />
                </Float>

                <Environment preset="city" />

                {/*  PERFORMANCE 5: Lowered resolution of ContactShadows from default to 512 */}
                <ContactShadows position={[0, -2.5, 0]} opacity={0.6} scale={15} blur={2} far={4} resolution={512} />

                <OrbitControls
                    enableZoom={true}
                    autoRotate
                    autoRotateSpeed={1.5}
                    maxPolarAngle={Math.PI / 2 + 0.1}
                    minPolarAngle={Math.PI / 3}
                />
            </Canvas>
        </div>
    );
}
