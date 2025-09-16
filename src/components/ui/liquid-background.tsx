import { useEffect, useRef } from 'react';

interface LiquidBackgroundProps {
  className?: string;
}

export function LiquidBackground({ className = '' }: LiquidBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl');
    if (!gl) {
      console.warn('WebGL not supported, falling back to CSS animation');
      return;
    }

    // Vertex shader source
    const vertexShaderSource = `
      attribute vec4 a_position;
      void main() {
        gl_Position = a_position;
      }
    `;

    // Fragment shader source for liquid chrome effect
    const fragmentShaderSource = `
      precision mediump float;
      uniform float u_time;
      uniform vec2 u_resolution;
      
      // Noise function
      float noise(vec2 p) {
        return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
      }
      
      // Smooth noise
      float smoothNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        
        float a = noise(i);
        float b = noise(i + vec2(1.0, 0.0));
        float c = noise(i + vec2(0.0, 1.0));
        float d = noise(i + vec2(1.0, 1.0));
        
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }
      
      // Fractal noise
      float fractalNoise(vec2 p) {
        float value = 0.0;
        float amplitude = 0.5;
        
        for(int i = 0; i < 4; i++) {
          value += amplitude * smoothNoise(p);
          p *= 2.0;
          amplitude *= 0.5;
        }
        
        return value;
      }
      
      void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution.xy;
        vec2 p = uv * 2.0 - 1.0;
        p.x *= u_resolution.x / u_resolution.y;
        
        // Create flowing liquid effect
        float time = u_time * 0.5;
        vec2 flow1 = vec2(sin(time * 0.3) * 0.5, cos(time * 0.2) * 0.3);
        vec2 flow2 = vec2(cos(time * 0.4) * 0.3, sin(time * 0.5) * 0.4);
        
        // Multiple noise layers for complexity
        float n1 = fractalNoise(p * 2.0 + flow1 + time * 0.1);
        float n2 = fractalNoise(p * 3.0 + flow2 + time * 0.15);
        float n3 = fractalNoise(p * 1.5 - flow1 + time * 0.08);
        
        // Combine noise layers
        float combined = (n1 + n2 * 0.7 + n3 * 0.5) / 2.2;
        
        // Create chrome-like gradient
        float gradient = length(p) * 0.5 + combined * 0.3;
        
        // Chrome color palette
        vec3 chrome1 = vec3(0.8, 0.9, 1.0);  // Light blue-white
        vec3 chrome2 = vec3(0.4, 0.6, 0.9);  // Medium blue
        vec3 chrome3 = vec3(0.1, 0.3, 0.7);  // Dark blue
        vec3 chrome4 = vec3(0.0, 0.1, 0.3);  // Very dark blue
        
        // Create smooth color transitions
        vec3 color = mix(chrome4, chrome3, smoothstep(0.0, 0.3, combined));
        color = mix(color, chrome2, smoothstep(0.3, 0.6, combined));
        color = mix(color, chrome1, smoothstep(0.6, 1.0, combined));
        
        // Add metallic highlights
        float highlight = pow(max(0.0, combined - 0.7), 2.0) * 3.0;
        color += vec3(highlight * 0.3, highlight * 0.4, highlight * 0.6);
        
        // Add subtle vignette
        float vignette = 1.0 - length(uv - 0.5) * 0.8;
        color *= vignette;
        
        gl_FragColor = vec4(color, 1.0);
      }
    `;

    // Create shader function
    function createShader(gl: WebGLRenderingContext, type: number, source: string) {
      const shader = gl.createShader(type);
      if (!shader) return null;
      
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      
      return shader;
    }

    // Create program function
    function createProgram(gl: WebGLRenderingContext, vertexShader: WebGLShader, fragmentShader: WebGLShader) {
      const program = gl.createProgram();
      if (!program) return null;
      
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
      
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program link error:', gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        return null;
      }
      
      return program;
    }

    // Setup WebGL
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    
    if (!vertexShader || !fragmentShader) return;
    
    const program = createProgram(gl, vertexShader, fragmentShader);
    if (!program) return;

    // Get attribute and uniform locations
    const positionAttributeLocation = gl.getAttribLocation(program, 'a_position');
    const timeUniformLocation = gl.getUniformLocation(program, 'u_time');
    const resolutionUniformLocation = gl.getUniformLocation(program, 'u_resolution');

    // Create buffer
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    
    // Full screen quad
    const positions = [
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1,
    ];
    
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    // Resize function
    function resize() {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
    }

    // Animation loop
    function animate(time: number) {
      if (!canvas) return;
      
      resize();
      
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      
      gl.useProgram(program);
      
      // Set uniforms
      gl.uniform1f(timeUniformLocation, time * 0.001);
      gl.uniform2f(resolutionUniformLocation, canvas.width, canvas.height);
      
      // Set up attributes
      gl.enableVertexAttribArray(positionAttributeLocation);
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);
      
      // Draw
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      
      animationRef.current = requestAnimationFrame(animate);
    }

    // Start animation
    resize();
    animationRef.current = requestAnimationFrame(animate);

    // Handle resize
    const handleResize = () => resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <div className={`fixed inset-0 -z-10 ${className}`}>
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ display: 'block' }}
      />
      {/* Fallback CSS animation for browsers without WebGL */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 animate-pulse opacity-50" />
    </div>
  );
}