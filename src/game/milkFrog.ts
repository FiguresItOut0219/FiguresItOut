import * as THREE from 'three'

export interface MilkFrog {
  root: THREE.Group
  animate: (distance: number, jumpHeight: number, dodge: number, running: boolean) => void
}

/** An articulated 3D model based on the supplied milk-frog reference. */
export function createMilkFrog(): MilkFrog {
  const root = new THREE.Group()
  const bodyRig = new THREE.Group()
  root.add(bodyRig)

  const yellow = new THREE.MeshStandardMaterial({ color: 0xf0bf50, roughness: .78 })
  const limbYellow = new THREE.MeshStandardMaterial({ color: 0xe6af3d, roughness: .8 })
  const cream = new THREE.MeshStandardMaterial({ color: 0xf7e9c2, roughness: .9 })
  const brown = new THREE.MeshStandardMaterial({ color: 0x665f49, roughness: .92 })
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

  // One continuous pear-shaped surface keeps the head and round belly connected.
  const profile = [
    [0, .45], [.39, .45], [.62, .54], [.77, .76], [.83, 1.09],
    [.81, 1.38], [.71, 1.68], [.57, 1.95], [.43, 2.22],
    [.33, 2.48], [.32, 2.7], [.27, 2.87], [.15, 2.97], [0, 2.99],
  ]
  const body = new THREE.Mesh(
    new THREE.LatheGeometry(profile.map(([radius, height]) => new THREE.Vector2(radius, height)), 40),
    yellow,
  )
  body.scale.z = .82
  body.castShadow = true
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
  tail.position.set(0, .94, -.7)
  tail.rotation.x = -Math.PI / 2
  tail.castShadow = true
  bodyRig.add(tail)

  const arms: THREE.Group[] = []
  const legs: THREE.Group[] = []
  for (const side of [-1, 1]) {
    const arm = new THREE.Group()
    arm.position.set(side * .6, 1.89, -.02)
    bodyRig.add(arm)
    const upper = oval(arm, limbYellow, side * .18, -.47, .02, .18, .56, .18)
    upper.rotation.z = side * .2
    oval(arm, brown, side * .29, -.95, .065, .16, .18, .17)
    arms.push(arm)

    const leg = new THREE.Group()
    leg.position.set(side * .42, .58, 0)
    root.add(leg)
    oval(leg, limbYellow, 0, -.16, 0, .2, .29, .23)
    oval(leg, brown, side * .04, -.43, .19, .27, .105, .3)
    for (let toe = -1; toe <= 1; toe++) {
      oval(leg, brown, side * .04 + toe * .16, -.45, .36, .11, .06, .15)
    }
    legs.push(leg)
  }

  root.rotation.y = -.16

  function animate(distance: number, jumpHeight: number, dodge: number, running: boolean) {
    const cadence = running && jumpHeight < .08 ? Math.sin(distance * 2.4) : 0
    root.position.y = jumpHeight
    root.rotation.z += ((-dodge * .17) - root.rotation.z) * .22
    root.rotation.y += ((-.16 + dodge * .11) - root.rotation.y) * .18
    bodyRig.position.y = running && jumpHeight < .08 ? Math.abs(cadence) * .045 : 0
    bodyRig.rotation.x = jumpHeight > .1 ? -.1 : .02
    arms[0].rotation.x = jumpHeight > .1 ? -1.2 : cadence * .6
    arms[1].rotation.x = jumpHeight > .1 ? -1.2 : -cadence * .6
    arms[0].rotation.z = jumpHeight > .1 ? -.34 : 0
    arms[1].rotation.z = jumpHeight > .1 ? .34 : 0
    legs[0].rotation.x = jumpHeight > .1 ? -.36 : -cadence * .45
    legs[1].rotation.x = jumpHeight > .1 ? -.36 : cadence * .45
    bodyRig.scale.set(1 + Math.min(jumpHeight, 1) * .04, 1 - Math.min(jumpHeight, 1) * .04, 1)
  }

  return { root, animate }
}
