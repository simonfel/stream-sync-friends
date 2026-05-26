export default function Home() {
  return (
    <main style={{ fontFamily: "system-ui", margin: "48px auto", maxWidth: 720, lineHeight: 1.5 }}>
      <h1>Stream Sync Friends Backend</h1>
      <p>API is running. Install the Chrome extension and point it at this URL.</p>
      <ul>
        <li><code>GET /api/health</code></li>
        <li><code>POST /api/rooms/:roomId/state</code></li>
        <li><code>GET /api/rooms/:roomId/state</code></li>
      </ul>
    </main>
  );
}
