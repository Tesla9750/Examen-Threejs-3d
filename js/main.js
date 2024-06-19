// Importar las librerías necesarias de THREE.js y módulos adicionales
import * as THREE from 'three';
import Stats from 'three/addons/libs/stats.module.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

// Declaración de variables globales para la cámara, escena, renderizador, reloj, mezclador de animaciones, etc.
let camara, escenario, renderizador, cronometro, mezclador, modelo, animaciones, animacionActiva, animacionAnterior, controles;
const teclado = {}; // Objeto para rastrear las teclas presionadas
const velocidadMovimiento = 250; // Velocidad de movimiento del modelo
const objetosColisionables = []; // Array para almacenar objetos con los que se puede colisionar

const estadisticas = new Stats(); // Instancia para mostrar estadísticas de rendimiento

// Inicializar la escena y comenzar la animación
iniciarEscenario();
animarEscena();

function iniciarEscenario() {
    // Crear un contenedor y añadirlo al cuerpo del documento
    const contenedor = document.createElement('div');
    document.body.appendChild(contenedor);

    // Crear y configurar la cámara
    camara = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, 2000);
    camara.position.set(0, 200, 400);
    camara.screenSpacePanning = false;

    // Crear la escena y configurar su fondo y niebla
    escenario = new THREE.Scene();
    escenario.background = new THREE.Color(0xB2D9F6);
    escenario.fog = new THREE.Fog(0x8E91A4, 200, 1400);

    // Añadir una luz hemisférica a la escena
    const luzHemisferica = new THREE.HemisphereLight(0xFDC373, 0xFDC373);
    luzHemisferica.position.set(0, 200, 0);
    escenario.add(luzHemisferica);

    // Añadir una luz direccional a la escena y configurar su sombra
    const luzDireccional = new THREE.DirectionalLight(0xffffff);
    luzDireccional.position.set(0, 200, 100);
    luzDireccional.castShadow = true;
    luzDireccional.shadow.camera.top = 180;
    luzDireccional.shadow.camera.bottom = -100;
    luzDireccional.shadow.camera.left = -120;
    luzDireccional.shadow.camera.right = 120;
    escenario.add(luzDireccional);

    // Crear y añadir el suelo a la escena
    const suelo = new THREE.Mesh(
        new THREE.PlaneGeometry(4000, 4000),
        new THREE.MeshPhongMaterial({ color: 0x999999, depthWrite: false })
    );
    suelo.rotation.x = -Math.PI / 2;
    suelo.receiveShadow = true;
    escenario.add(suelo);

    // Crear y añadir una cuadrícula de triángulos a la escena
    const geometriaTriangulos = new THREE.BufferGeometry();
    const vertices = [];
    const size = 4000;
    const divisions = 40;
    const step = size / divisions;

    for (let i = 0; i < divisions; i++) {
        for (let j = 0; j < divisions; j++) {
            const x = i * step - size / 2;
            const z = j * step - size / 2;

            // Primer triángulo
            vertices.push(x, 0, z);
            vertices.push(x + step, 0, z);
            vertices.push(x + step, 0, z + step);

            // Segundo triángulo
            vertices.push(x, 0, z);
            vertices.push(x + step, 0, z + step);
            vertices.push(x, 0, z + step);
        }
    }

    geometriaTriangulos.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    const materialTriangulos = new THREE.MeshBasicMaterial({ color: 0x000000, wireframe: true, opacity: 0.2, transparent: true });
    const mallaTriangulos = new THREE.Mesh(geometriaTriangulos, materialTriangulos);
    escenario.add(mallaTriangulos);

    // Crear un cargador de modelos FBX
    const cargadorFBX = new FBXLoader();

    // Cargar el modelo principal y configurar sus sombras
    cargadorFBX.load('Models/fbx/paladin.fbx', function (objeto) {
        modelo = objeto;
        modelo.scale.set(1, 1, 1);
        modelo.traverse(function (child) {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        escenario.add(modelo);

        // Crear un mezclador de animaciones para el modelo
        mezclador = new THREE.AnimationMixer(modelo);
        animaciones = {};

        // Cargar y añadir varias animaciones al modelo
        cargarAnimaciones(cargadorFBX, mezclador, animaciones);

        // Crear y añadir cubos a la escena como objetos colisionables
        crearCubosColisionables(escenario, objetosColisionables);

        // Añadir eventos para detectar teclas presionadas y soltadas
        window.addEventListener('keydown', manejarTeclaPresionada);
        window.addEventListener('keyup', manejarTeclaSoltada);
    });

    // Crear y configurar el renderizador
    renderizador = new THREE.WebGLRenderer({ antialias: true });
    renderizador.setPixelRatio(window.devicePixelRatio);
    renderizador.setSize(window.innerWidth, window.innerHeight);
    renderizador.shadowMap.enabled = true;
    contenedor.appendChild(renderizador.domElement);

    // Crear controles de órbita para la cámara
    controles = new OrbitControls(camara, renderizador.domElement);
    controles.target.set(0, 100, 0);
    controles.update();

    // Añadir evento para redimensionar la ventana
    window.addEventListener('resize', ajustarVentana);

    // Crear un reloj para medir el tiempo
    cronometro = new THREE.Clock();
    contenedor.appendChild(estadisticas.dom);

    // Crear una GUI para controlar la iluminación y la neblina
    const gui = new GUI({ position: { x: window.innerWidth - 300, y: 10 } });
    const carpetaLuz = gui.addFolder('Iluminación');
    const carpetaNiebla = gui.addFolder('Neblina');

    carpetaLuz.add(luzDireccional, 'intensity', 0, 2, 0.01).name('Intensidad Dirección');
    carpetaLuz.add(luzHemisferica, 'intensity', 0, 2, 0.01).name('Intensidad Hemisferio');
    carpetaNiebla.add(escenario.fog, 'far', 500, 3000, 1).name('Distancia');

    // Crear el texto de instrucciones
    const instrucciones = document.createElement('div');
    instrucciones.style.position = 'absolute';
    instrucciones.style.top = '10px';
    instrucciones.style.left = '10px';
    instrucciones.style.color = 'white';
    instrucciones.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    instrucciones.style.padding = '10px';
    instrucciones.innerHTML = `
        <h2>Controles</h2>
        <p><strong>W, A, S, D:</strong> Mover el modelo</p>
        <p><strong>Q:</strong> Ataque 1</p>
        <p><strong>E:</strong> Ataque 2</p>
        <p><strong>R:</strong> Defensa</p>
        <p><strong>B:</strong> Emoción</p>
        <p><strong>T:</strong> Patada</p>
    `;
    document.body.appendChild(instrucciones);
}

// Función para cargar las animaciones del modelo
function cargarAnimaciones(cargador, mezclador, animaciones) {
    cargador.load('Models/fbx/combatidle.fbx', function (anim) {
        const accionIdle = mezclador.clipAction(anim.animations[0]);
        animaciones.idle = accionIdle;
        if (!animacionActiva) {
            animacionActiva = accionIdle;
            animacionActiva.play();
        }
    });

    cargador.load('Models/fbx/walk.fbx', function (anim) {
        const accionCaminar = mezclador.clipAction(anim.animations[0]);
        animaciones.walk = accionCaminar;
    });

    cargador.load('Models/fbx/swordattack1.fbx', function (anim) {
        const accionAtaque1 = mezclador.clipAction(anim.animations[0]);
        animaciones.attack1 = accionAtaque1;
    });

    cargador.load('Models/fbx/swordattack2slash.fbx', function (anim) {
        const accionAtaque2 = mezclador.clipAction(anim.animations[0]);
        animaciones.attack2 = accionAtaque2;
    });

    cargador.load('Models/fbx/DefensePosition.fbx', function (anim) {
        const accionDefensa = mezclador.clipAction(anim.animations[0]);
        animaciones.defense = accionDefensa;
    });

    cargador.load('Models/fbx/ScreamBattle.fbx', function (anim) {
        const accionEmocion = mezclador.clipAction(anim.animations[0]);
        animaciones.emote = accionEmocion;
    });

    cargador.load('Models/fbx/paladinkick.fbx', function (anim) {
        const accionPatada = mezclador.clipAction(anim.animations[0]);
        animaciones.kick = accionPatada;
    });
}

// Función para crear y añadir cubos colisionables a la escena
function crearCubosColisionables(escenario, objetosColisionables) {
    const geometriaCaja = new THREE.BoxGeometry(100, 100, 100);
    const materialCaja = new THREE.MeshPhongMaterial({ color: 0x00ff00 });

    for (let i = 0; i < 10; i++) {
        const cubo = new THREE.Mesh(geometriaCaja, materialCaja);
        cubo.position.set(
            Math.random() * 2000 - 1000,
            25,
            Math.random() * 2000 - 1000
        );
        cubo.castShadow = false;
        cubo.receiveShadow = false;
        escenario.add(cubo);
        objetosColisionables.push(cubo);
    }
}

// Función para ajustar el tamaño del renderizador al redimensionar la ventana
function ajustarVentana() {
    camara.aspect = window.innerWidth / window.innerHeight;
    camara.updateProjectionMatrix();
    renderizador.setSize(window.innerWidth, window.innerHeight);
}

// Función para manejar la presión de teclas y actualizar el objeto teclado
function manejarTeclaPresionada(evento) {
    teclado[evento.key.toLowerCase()] = true;
    gestionarAnimacion();
}

// Función para manejar la liberación de teclas y actualizar el objeto teclado
function manejarTeclaSoltada(evento) {
    teclado[evento.key.toLowerCase()] = false;
    gestionarAnimacion();
}

// Función para gestionar las animaciones en función de las teclas presionadas
function gestionarAnimacion() {
    if (teclado['w'] || teclado['s'] || teclado['a'] || teclado['d']) {
        if (animacionActiva !== animaciones.walk) {
            cambiarAnimacion(animaciones.walk);
        }
    } else if (teclado['q']) {
        if (animacionActiva !== animaciones.attack1) {
            cambiarAnimacion(animaciones.attack1);
        }
    } else if (teclado['e']) {
        if (animacionActiva !== animaciones.attack2) {
            cambiarAnimacion(animaciones.attack2);
        }
    } else if (teclado['r']) {
        if (animacionActiva !== animaciones.defense) {
            cambiarAnimacion(animaciones.defense);
        }
    } else if (teclado['b']) {
        if (animacionActiva !== animaciones.emote) {
            cambiarAnimacion(animaciones.emote);
        }
    } else if (teclado['t']) {
        if (animacionActiva !== animaciones.kick) {
            cambiarAnimacion(animaciones.kick);
        }
    } else {
        if (animacionActiva !== animaciones.idle) {
            cambiarAnimacion(animaciones.idle);
        }
    }
}

// Función para cambiar entre animaciones
function cambiarAnimacion(nuevaAnimacion) {
    if (animacionActiva !== nuevaAnimacion) {
        animacionAnterior = animacionActiva;
        animacionActiva = nuevaAnimacion;

        animacionAnterior.fadeOut(0.5);
        animacionActiva.reset().fadeIn(0.5).play();
    }
}

// Función para animar la escena en cada frame
function animarEscena() {
    requestAnimationFrame(animarEscena);

    const delta = cronometro.getDelta();
    const distanciaMovimiento = velocidadMovimiento * delta;

    if (mezclador) mezclador.update(delta);

    // Variables para controlar el movimiento del modelo
    let moverX = 0;
    let moverZ = 0;

    // Detectar las teclas presionadas para mover el modelo
    if (teclado['w']) {
        moverZ = -distanciaMovimiento;
    }
    if (teclado['s']) {
        moverZ = distanciaMovimiento;
    }
    if (teclado['a']) {
        moverX = -distanciaMovimiento;
    }
    if (teclado['d']) {
        moverX = distanciaMovimiento;
    }

    // Si se está moviendo en alguna dirección, ajustar la orientación del modelo
    if (moverX !== 0 || moverZ !== 0) {
        const vectorMovimiento = new THREE.Vector3(moverX, 0, moverZ);
        const direccion = vectorMovimiento.clone().applyQuaternion(camara.quaternion);
        direccion.y = 0; // Evitar el movimiento vertical del modelo
        modelo.lookAt(modelo.position.clone().add(direccion)); // Apuntar el modelo hacia la dirección de movimiento
        if (!verificarColision(modelo.position.clone().add(direccion))) {
            modelo.position.add(direccion); // Mover el modelo si no hay colisión
        }
    }

    // Renderizar la escena con el renderizador
    renderizador.render(escenario, camara);

    // Actualizar las estadísticas de rendimiento
    estadisticas.update();
}

// Función para verificar colisiones con objetos colisionables
function verificarColision(nuevaPosicion) {
    const caja = new THREE.Box3().setFromObject(modelo); // Obtener el bounding box actual del modelo
    const boundingBoxModelo = caja.clone().translate(nuevaPosicion.sub(modelo.position)); // Obtener el nuevo bounding box trasladado

    // Iterar sobre los objetos colisionables y verificar si hay intersección
    for (let i = 0; i < objetosColisionables.length; i++) {
        const boundingBoxObjeto = new THREE.Box3().setFromObject(objetosColisionables[i]);
        if (boundingBoxModelo.intersectsBox(boundingBoxObjeto)) {
            return true; // Hay colisión
        }
    }
    return false; // No hay colisión
}
