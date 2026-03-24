// vite.config.ts
import tailwindcss from "file:///Users/cesardavidocampoguzman/Desktop/ai-shape/frontend/node_modules/@tailwindcss/vite/dist/index.mjs";
import { defineConfig } from "file:///Users/cesardavidocampoguzman/Desktop/ai-shape/frontend/node_modules/vite/dist/node/index.js";
import react from "file:///Users/cesardavidocampoguzman/Desktop/ai-shape/frontend/node_modules/@vitejs/plugin-react/dist/index.js";
var vite_config_default = defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/health": "http://localhost:3000",
      "/auth": "http://localhost:3000",
      "/users": "http://localhost:3000",
      "/diets": "http://localhost:3000",
      "/workouts": "http://localhost:3000",
      "/progress": "http://localhost:3000",
      "/shopping": "http://localhost:3000"
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvY2VzYXJkYXZpZG9jYW1wb2d1em1hbi9EZXNrdG9wL2FpLXNoYXBlL2Zyb250ZW5kXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvVXNlcnMvY2VzYXJkYXZpZG9jYW1wb2d1em1hbi9EZXNrdG9wL2FpLXNoYXBlL2Zyb250ZW5kL3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9Vc2Vycy9jZXNhcmRhdmlkb2NhbXBvZ3V6bWFuL0Rlc2t0b3AvYWktc2hhcGUvZnJvbnRlbmQvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgdGFpbHdpbmRjc3MgZnJvbSBcIkB0YWlsd2luZGNzcy92aXRlXCI7XG5pbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiO1xuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdFwiO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBwbHVnaW5zOiBbcmVhY3QoKSwgdGFpbHdpbmRjc3MoKV0sXG4gIHNlcnZlcjoge1xuICAgIHBvcnQ6IDUxNzMsXG4gICAgcHJveHk6IHtcbiAgICAgIFwiL2hlYWx0aFwiOiBcImh0dHA6Ly9sb2NhbGhvc3Q6MzAwMFwiLFxuICAgICAgXCIvYXV0aFwiOiBcImh0dHA6Ly9sb2NhbGhvc3Q6MzAwMFwiLFxuICAgICAgXCIvdXNlcnNcIjogXCJodHRwOi8vbG9jYWxob3N0OjMwMDBcIixcbiAgICAgIFwiL2RpZXRzXCI6IFwiaHR0cDovL2xvY2FsaG9zdDozMDAwXCIsXG4gICAgICBcIi93b3Jrb3V0c1wiOiBcImh0dHA6Ly9sb2NhbGhvc3Q6MzAwMFwiLFxuICAgICAgXCIvcHJvZ3Jlc3NcIjogXCJodHRwOi8vbG9jYWxob3N0OjMwMDBcIixcbiAgICAgIFwiL3Nob3BwaW5nXCI6IFwiaHR0cDovL2xvY2FsaG9zdDozMDAwXCIsXG4gICAgfSxcbiAgfSxcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUF1VixPQUFPLGlCQUFpQjtBQUMvVyxTQUFTLG9CQUFvQjtBQUM3QixPQUFPLFdBQVc7QUFFbEIsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsU0FBUyxDQUFDLE1BQU0sR0FBRyxZQUFZLENBQUM7QUFBQSxFQUNoQyxRQUFRO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixPQUFPO0FBQUEsTUFDTCxXQUFXO0FBQUEsTUFDWCxTQUFTO0FBQUEsTUFDVCxVQUFVO0FBQUEsTUFDVixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixhQUFhO0FBQUEsTUFDYixhQUFhO0FBQUEsSUFDZjtBQUFBLEVBQ0Y7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
