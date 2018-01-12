function createProgram (gl, { vsrc, fsrc }) {
  var vs = gl.createShader(gl.VERTEX_SHADER)
  var fs = gl.createShader(gl.FRAGMENT_SHADER)
  var p = gl.createProgram() 
  
  gl.shaderSource(vs, vsrc) 
  gl.compileShader(vs)
  gl.shaderSource(fs, fsrc)
  gl.compileShader(fs)
  gl.attachShader(p, vs)
  gl.attachShader(p, fs)
  gl.linkProgram(p)
  gl.validateProgram(p)

  if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS))
    throw new Error(gl.getShaderInfoLog(vs) || '')
  if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS))
    throw new Error(gl.getShaderInfoLog(fs) || '')
  if (!gl.getProgramParameter(p, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(p) || '')

  return p
}

function getLocations (gl, p, locations) {
  var out = {}

  for ( const name of locations ) 
    out[name] = gl.getAttribLocation(p, name)

  return out
}

var glCanvas = document.createElement('canvas')
var gl = glCanvas.getContext('webgl2')

var p = createProgram(gl, {
  vsrc: `#version 300 es
    in vec2 position;

    void main () {
      gl_Position = vec4(position, 0, 1);
    } 
  `,
  fsrc: `#version 300 es
    precision highp float;

    out vec4 color;

    void main () {
      color = vec4(1, 0, 1, 1); 
    } 
  `
})

var blit = createProgram(gl, {
  vsrc: `#version 300 es
    in vec2 position;

    out vec2 uv;

    void main () {
      uv = position;
      gl_Position = vec4(position, 0, 1);
    } 
  `,
  fsrc: `#version 300 es
    precision highp float;

    uniform sampler2D src; 

    in vec2 uv;    

    out vec4 color;

    void main () {
      color = texture(src, uv); 
    } 
  `
})

// attrs/uniforms
var locations = getLocations(gl, p, [ 'position' ])

// triangle buffer
var verts = new Float32Array([ -1, -1, 1, 0, -1, 1 ])
var b = gl.createBuffer()

// pixel buffer objects
var pbos = [ gl.createBuffer(), gl.createBuffer() ]
var index = 0
var nextIndex = 1
var width = 300
var height = 150
var channelCount = 4
var pixels = new Uint8Array(width * height * channelCount)

gl.bindBuffer(gl.ARRAY_BUFFER, b)
gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW)
gl.bindBuffer(gl.ARRAY_BUFFER, null)

gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pbos[0])
gl.bufferData(gl.PIXEL_PACK_BUFFER, pixels.length, gl.DYNAMIC_READ) 
gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pbos[1])
gl.bufferData(gl.PIXEL_PACK_BUFFER, pixels.length, gl.DYNAMIC_READ) 
gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null)

/*
  TODO:

  render to a render texture. 
  blit that render texture.
  read previous rt into pbo
  read next pbo to cpu

  measure performance?

  This will result in the renderer using this frame's rendered output captured in a RT
  The copy then to the PBO doesn't depend on the render finishing as it is copying
  from last frame's RT.
  The data being read to the CPU is thus two frames old?
*/
function render () {
  index = (index + 1) % 2
  nextIndex = (index + 1) % 2
  
  gl.viewport(0, 0, glCanvas.clientWidth, glCanvas.clientHeight)
  gl.clearColor(0, 0, 0, 1)
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

  gl.useProgram(p)
  gl.disable(gl.DEPTH_TEST)
  gl.bindBuffer(gl.ARRAY_BUFFER, b)
  gl.enableVertexAttribArray(locations.position)
  gl.vertexAttribPointer(locations.position, 2, gl.FLOAT, gl.FALSE, 0, 0)
  gl.drawArrays(gl.TRIANGLES, 0, 3)
  gl.bindBuffer(gl.ARRAY_BUFFER, null)
  gl.useProgram(null)

  // copy index buffer to PBO, read pixels to CPU from nextIndex PBO
  gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pbos[index])
  gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, pixels)
  gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pbos[nextIndex])
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, 0)
  gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null)

  requestAnimationFrame(render)
}

document.body.style.margin = 0
document.body.appendChild(glCanvas)
glCanvas.addEventListener('mousemove', function (e) {
  var x = e.clientX
  var y = e.clientY
  var i = channelCount * (y * width + x)
  var p = pixels.subarray(i, i + channelCount)

  console.log(p)
})
requestAnimationFrame(render)
