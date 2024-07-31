import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import GUI from "lil-gui";

import vertexShader from "./shaders/vertex.glsl";
import fragmentShader from "./shaders/fragment.glsl";

export default class Sketch {
  constructor(canvas, contentCanvas) {
    this.canvas = canvas;
    this.contentCanvas = contentCanvas;
    this.context = this.contentCanvas.getContext("2d");
    this.contentCanvas.width = window.innerWidth;
    this.contentCanvas.height = window.innerHeight;
    this.mouse = new THREE.Vector2(0, 0);
    this.prevMouse = new THREE.Vector2(0, 0);
    this.currentWave = 0;
    this.initScene();
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.scene1 = new THREE.Scene();
  }

  initGUI() {
    this.settings = {
      progress: 0,
    };

    this.gui = new GUI();
    this.gui.add(this.settings, "progress", 0, 1, 0.01);
  }

  initCamera() {
    const aspect = this.contentCanvas.width / this.contentCanvas.height;
    const frustumSize = this.contentCanvas.height;

    this.camera = new THREE.OrthographicCamera(
      (frustumSize * aspect) / -2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      frustumSize / -2,
      1,
      1000
    );
    this.camera.position.set(0, 0, 5);
    this.sizes = {
      width: this.contentCanvas.width,
      height: this.contentCanvas.height,
    };
    this.scene.add(this.camera);
  }

  initRenderer() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas });
    this.renderer = setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.physicallyCorrectLights = true;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
  }

  initControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
  }

  mouseEvents() {
    window.addEventListener("mousemove", (e) => {
      this.mouse.x = e.clientX - window.innerWidth / 2;
      this.mouse.y = -e.clientY + window.innerHeight / 2;
    });
  }

  addObjects() {
    this.material = new THREE.ShaderMaterial({
      extensions: {
        derivatives: "#extension GL_OES_standard_derivatives : enable",
      },
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uDisplacement: { value: null },
        uTexture: { value: null },
        uResolution: { value: new THREE.Vector4() },
      },
      fragmentShader: fragmentShader,
      vertexShader: vertexShader,
    });

    this.max = 100;

    this.geometry = new THREE.PlaneGeometry(80, 80, 1, 1);
    this.geometryFullScreen = new THREE.PlaneGeometry(
      this.sizes.width,
      this.sizes.height,
      1,
      1
    );

    this.meshes = [];

    for (let i = 0; i < this.max; i++) {
      let materialMesh = new THREE.MeshBasicMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false,
      });

      let mesh = new THREE.Mesh(this.geometry, materialMesh);
      mesh.visible = false;
      mesh.rotation.z = 2 * Math.PI * Math.random();
      this.scene.add(mesh);
      this.meshes.push(mesh);
    }

    this.quad = new THREE.Mesh(this.geometryFullScreen, this.material);
    this.scene1.add(this.quad);
  }

  setupResize() {
    window.addEventListener("resize", () => this.onResize());
  }

  onResize() {
    this.sizes.width = window.innerWidth;
    this.sizes.height = window.innerHeight;

    const aspect = this.sizes.width / this.sizes.height;
    const frustumSize = this.sizes.height;

    this.camera.left = (frustumSize * aspect) / -2;
    this.camera.right = (frustumSize * aspect) / 2;
    this.camera.top = frustumSize / 2;
    this.camera.bottom = frustumSize / -2;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(this.sizes.width, this.sizes.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.contentCanvas.width = this.sizes.width;
    this.contentCanvas.height = this.sizes.height;
    this.canvasTexture.needsUpdate = true;
  }

  setNewWave(x, y, index) {
    let mesh = this.meshes[index];
    mesh.visible = true;
    mesh.position.x = x;
    mesh.position.y = y;
    mesh.scale.x = mesh.scale.y = 1;
    mesh.material.opacity = 1;
  }

  trackMousePos() {
    if (
      Math.abs(this.mouse.x - this.prevMouse.x) < 4 &&
      Math.abs(this.mouse.y - this.prevMouse.y) < 4
    ) {
    } else {
      this.setNewWave(this.mouse.x, this.mouse.y, this.currentWave);
      this.currentWave = (this.currentWave + 1) % this.max;
    }

    this.prevMouse.x = this.mouse.x;
    this.prevMouse.y = this.mouse.y;
  }

  animate() {
    this.trackMousePos();
    if (!this.clock) {
      this.clock = new THREE.Clock();
    }
    const elapsedTime = this.clock.getElapsedTime();
    this.controls.update();

    // Dessiner le contenu de l'application sur le canvas
    this.context.clearRect(
      0,
      0,
      this.contentCanvas.width,
      this.contentCanvas.height
    );
    this.context.drawImage(
      document.body,
      0,
      0,
      this.contentCanvas.width,
      this.contentCanvas.height
    );
    this.canvasTexture.needsUpdate = true;

    this.material.uniforms.uTexture.value = this.canvasTexture;

    window.requestAnimationFrame(() => this.animate());

    // Render scene to texture
    this.renderer.setRenderTarget(this.renderTarget);
    this.renderer.render(this.scene, this.camera);

    // Use the rendered texture in the shader
    this.material.uniforms.uDisplacement.value = this.renderTarget.texture;

    // Render the final scene
    this.renderer.setRenderTarget(null);
    this.renderer.clear();
    this.renderer.render(this.scene1, this.camera);

    this.meshes.forEach((mesh) => {
      if (mesh.visible) {
        mesh.rotation.z += 0.02;
        mesh.material.opacity *= 0.93;
        if (mesh.material.opacity < 0.002) mesh.visible = false;
        mesh.scale.x = 0.98 * mesh.scale.x + 0.1;
        mesh.scale.y = 1.01 * mesh.scale.x;
      }
    });
  }
}

// Initialisation
const canvas = document.querySelector(".webgl");
const contentCanvas = document.querySelector(".contentCanvas");
new Sketch(canvas, contentCanvas);

const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const squareSize = 200; // Taille du carré
let x = 0; // Position initiale du carré
const speed = 2; // Vitesse de déplacement du carré

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height); // Efface le canvas

  ctx.fillStyle = "red"; // Couleur du carré
  ctx.fillRect(x, canvas.height / 2 - squareSize / 2, squareSize, squareSize); // Dessine le carré

  x += speed; // Met à jour la position du carré

  // Si le carré sort de l'écran, le réinitialiser à gauche
  if (x > canvas.width) {
    x = -squareSize;
  }

  requestAnimationFrame(draw); // Demande à dessiner la prochaine frame
}

draw(); // Lance l'animation
