import * as THREE from 'three'

export interface MilkFrog {
  root: THREE.Group
  animate: (distance: number, jumpHeight: number, dodge: number, running: boolean, flight: number) => void
}

/** An articulated 3D model based on the supplied milk-frog reference. */
export function createMilkFrog(): MilkFrog {
  const root = new THREE.Group()
  const bodyRig = new THREE.Group()
  root.add(bodyRig)

  const yellow = new THREE.MeshStandardMaterial({ color: 0xf0bf50, roughness: .78 })
  const limbYellow = new THREE.MeshStandardMaterial({ color: 0xe6af3d, roughness: .8 })
  const cream = new THREE.MeshStandardMaterial({ color: 0xf7e9c2, roughness: .9 })
  const brown = new THREE.MeshStandardMaterial({ color: 0x514d40, roughness: .92 })
  const white = new THREE.MeshStandardMaterial({ color: 0xfff8df, roughness: .42 })
  const iris = new THREE.MeshStandardMaterial({ color: 0x7da865, roughness: .38 })
  const pupil = new THREE.MeshStandardMaterial({ color: 0x1b3026, roughness: .27 })
  const smile = new THREE.MeshStandardMaterial({ color: 0x554b37, roughness: .9 })
  const shine = new THREE.MeshBasicMaterial({ color: 0xffffff })

  function oval(parent: THREE.Object3D, material: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), material)
    mesh.position.set(x, y, z)
    mesh.scale.set(sx, sy, sz)
    mesh.castShadow = true
    parent.add(mesh)
    return mesh
  }

  function armGeometry(side: number) {
    const rings = [
      { x: .05, y: .06, radius: .12 },
      { x: .15, y: -.14, radius: .17 },
      { x: .26, y: -.35, radius: .17 },
      { x: .32, y: -.56, radius: .145 },
      { x: .35, y: -.76, radius: .12 },
      { x: .35, y: -.92, radius: .11 },
    ]
    const segments = 16
    const vertices: number[] = []
    const indices: number[] = []
    for (const ring of rings) {
      for (let i = 0; i < segments; i++) {
        const angle = i / segments * Math.PI * 2
        vertices.push(side * ring.x + Math.cos(angle) * ring.radius, ring.y, Math.sin(angle) * ring.radius)
      }
    }
    for (let ring = 0; ring < rings.length - 1; ring++) {
      for (let i = 0; i < segments; i++) {
        const a = ring * segments + i
        const next = ring * segments + (i + 1) % segments
        const b = (ring + 1) * segments + i
        const nextB = (ring + 1) * segments + (i + 1) % segments
        indices.push(a, next, b, next, nextB, b)
      }
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()
    return geometry
  }

  // A sampled round crown keeps the head soft rather than ending in a cone tip.
  const profile = [
    [0, .45], [.39, .45], [.62, .54], [.77, .76], [.83, 1.09],
    [.81, 1.38], [.72, 1.68], [.6, 1.95], [.47, 2.22],
    [.4, 2.47], [.4, 2.68], [.35, 2.8], [.26, 2.9], [.13, 2.96], [0, 2.98],
  ]
  const roundedProfile = new THREE.SplineCurve(profile.map(([radius, height]) => new THREE.Vector2(radius, height)))
  const body = new THREE.Mesh(
    new THREE.LatheGeometry(roundedProfile.getPoints(84).map(point => new THREE.Vector2(Math.max(0, point.x), point.y)), 48),
    yellow,
  )
  body.scale.z = .82
  body.castShadow = true
  body.receiveShadow = true
  bodyRig.add(body)

  // The pale belly is a shallow raised patch, matching the reference's soft edge.
  oval(bodyRig, cream, 0, 1.19, .64, .6, .74, .14)

  for (const side of [-1, 1]) {
    oval(bodyRig, yellow, side * .23, 2.59, .24, .145, .14, .11)
    oval(bodyRig, white, side * .23, 2.6, .325, .105, .108, .044)
    oval(bodyRig, iris, side * .23 + .012, 2.6, .365, .069, .075, .02)
    oval(bodyRig, pupil, side * .23 + .02, 2.6, .383, .035, .047, .012)
    oval(bodyRig, shine, side * .23, 2.635, .397, .018, .02, .006)
  }
  oval(bodyRig, smile, 0, 2.31, .373, .19, .023, .012)

  // The little tail is visible when the body turns while dodging.
  const tail = new THREE.Mesh(new THREE.ConeGeometry(.16, .38, 12), yellow)
  tail.position.set(0, .9, -.68)
  tail.rotation.x = -Math.PI / 2
  tail.castShadow = true
  bodyRig.add(tail)

  const arms: THREE.Group[] = []
  const legs: THREE.Group[] = []
  for (const side of [-1, 1]) {
    const arm = new THREE.Group()
    arm.position.set(side * .52, 1.68, -.02)
    bodyRig.add(arm)
    const upper = new THREE.Mesh(armGeometry(side), yellow)
    upper.castShadow = true
    arm.add(upper)
    oval(arm, brown, side * .35, -.92, -.1, .19, .19, .2)
    arms.push(arm)

    const leg = new THREE.Group()
    leg.position.set(side * .42, .58, 0)
    root.add(leg)
    oval(leg, limbYellow, 0, -.16, 0, .2, .29, .23)
    oval(leg, brown, side * .04, -.43, .19, .27, .105, .3)
    oval(leg, brown, side * .04, -.43, -.22, .29, .13, .24)
    for (let toe = -1; toe <= 1; toe++) {
      oval(leg, brown, side * .04 + toe * .16, -.45, .36, .11, .06, .15)
    }
    legs.push(leg)
  }

  // The model's face is built toward +Z; turn it toward the road's -Z direction.
  const forwardAngle = Math.PI - .28
  root.rotation.y = forwardAngle

  function animate(distance: number, jumpHeight: number, dodge: number, running: boolean, flight: number) {
    const cadence = running && jumpHeight < .08 && flight < .05 ? Math.sin(distance * 2.4) : 0
    root.position.y = jumpHeight
    root.rotation.x += (-flight * .88 - root.rotation.x) * .14
    root.rotation.z += ((-dodge * .17) - root.rotation.z) * .22
    root.rotation.y += ((forwardAngle + dodge * .09) - root.rotation.y) * .18
    bodyRig.position.y = flight > .05 ? Math.sin(distance * .32) * .05 * flight : running && jumpHeight < .08 ? Math.abs(cadence) * .045 : 0
    bodyRig.rotation.x = flight > .05 ? .1 * flight : jumpHeight > .1 ? -.1 : .02
    arms[0].rotation.x = flight > .05 ? -1.55 * flight : jumpHeight > .1 ? -1.2 : cadence * .6
    arms[1].rotation.x = flight > .05 ? -1.55 * flight : jumpHeight > .1 ? -1.2 : -cadence * .6
    arms[0].rotation.z = flight > .05 ? -.42 : jumpHeight > .1 ? -.34 : 0
    arms[1].rotation.z = flight > .05 ? .42 : jumpHeight > .1 ? .34 : 0
    legs[0].rotation.x = flight > .05 ? .42 : jumpHeight > .1 ? -.36 : -cadence * .45
    legs[1].rotation.x = flight > .05 ? .42 : jumpHeight > .1 ? -.36 : cadence * .45
    bodyRig.scale.set(1 + Math.min(jumpHeight, 1) * .04 * (1 - flight), 1 - Math.min(jumpHeight, 1) * .04 * (1 - flight), 1)
  }

  return { root, animate }
}
