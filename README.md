# BYTE Frames

> ⚠️ **UNDER ACTIVE DEVELOPMENT** ⚠️  
> This project is currently being ported to a native desktop application using Wails.  
> Features may be incomplete, APIs may change, and bugs are expected.  
> **Not recommended for production use yet.**

**Native desktop overlay widget manager for OBS Studio**

A powerful, native macOS application built with Wails that allows you to create, manage, and preview custom overlay widgets for OBS Studio. Design dynamic overlays with JavaScript and CSS, organize them into scenes, and preview them with OBS VirtualCam/NDI feeds.

![Platform](https://img.shields.io/badge/platform-macOS-blue)
![Go Version](https://img.shields.io/badge/go-1.21+-blue)
![Wails](https://img.shields.io/badge/wails-v2.11.0-blue)
![React](https://img.shields.io/badge/react-19.2.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

### 🎨 Widget Development
- **Live Code Editor**: Built-in Monaco editor for JavaScript and CSS
- **Real-time Preview**: See your widgets in action with OBS VirtualCam/NDI
- **Hot Reload**: Changes reflect immediately in the preview
- **Widget Library**: Reusable widgets across multiple scenes

### 🎬 Scene Management
- **Multiple Configs**: Organize widgets into different scenes/presets
- **Per-Scene Settings**: Same widget, different configurations per scene
- **Z-Index Control**: Layer widgets precisely
- **Enable/Disable**: Toggle widgets per scene without deletion

### 📺 OBS Integration
- **VirtualCam Support**: Preview with OBS Virtual Camera
- **NDI Support**: Connect to NDI video feeds
- **WebSocket Connection**: Control OBS directly from the app
- **Source Management**: View and manage OBS scenes and sources

### 💾 Native Database
- **SQLite Backend**: Fast, reliable native storage
- **No Browser Limitations**: No localStorage size constraints
- **Automatic Backups**: WAL mode for data safety
- **Migration Support**: Seamless schema upgrades

## Architecture

```
BYTE Frames
├── Go Backend (Wails)
│   ├── Native SQLite database
│   ├── Widget & config management
│   └── Settings persistence
├── React Frontend
│   ├── Monaco code editor
│   ├── OBS WebSocket client
│   ├── Widget runtime engine
│   └── Mosaic layout system
└── Database Schema
    ├── widgets (reusable library)
    ├── configs (scenes/presets)
    ├── config_widgets (junction table)
    ├── widget_runtime (mount state)
    └── settings (app preferences)
```

## Database Schema

### Widgets (Reusable Library)
- Widgets are stored independently and can be reused across configs
- Each widget contains JavaScript and CSS code
- Metadata includes creation/update timestamps

### Configs (Scenes)
- Named collections of widgets
- Only one config can be active at a time
- Configs reference widgets through junction table

### Config-Widget Relationship
- Per-config settings: enabled, z-index, position
- Same widget can have different settings in different configs
- Allows widget library pattern

## Prerequisites

- **macOS** 10.13 or later
- **Go** 1.21 or later
- **Node.js** 18+ (Bun recommended)
- **Wails CLI** v2.11.0+

## Installation

### Install Wails CLI
```bash
go install github.com/wailsapp/wails/v2/cmd/wails@latest
```

### Clone Repository
```bash
git clone https://github.com/BYTE-6D65/ByteFrames-Workspace.git
cd ByteFrames-Workspace/byteframes
```

### Install Frontend Dependencies
```bash
cd frontend
bun install  # or npm install
cd ..
```

## Development

### Run in Dev Mode (Hot Reload)
```bash
wails dev
```

This starts the development server with:
- Hot reload for frontend changes
- Live backend recompilation
- Developer console access
- WebView debugging

### Build for Production
```bash
wails build
```

The built app will be at: `build/bin/byteframes.app`

### Generate Bindings
After changing Go backend functions:
```bash
wails generate module
```

## Usage

### Creating a Widget

1. **Open the Workspace tab**
2. **Click "New Widget"**
3. **Write your JavaScript**:
   ```javascript
   export default function Widget(ctx) {
     let raf = 0
     return {
       mount(el) {
         const div = document.createElement('div')
         div.className = 'my-widget'
         div.textContent = 'Hello, OBS!'
         el.appendChild(div)
       },
       unmount() {
         cancelAnimationFrame(raf)
       }
     }
   }
   ```

4. **Style with CSS**:
   ```css
   .my-widget {
     position: absolute;
     top: 20px;
     left: 20px;
     font-size: 24px;
     color: white;
   }
   ```

5. **Click "Save" and "Apply"**

### Managing Scenes (Configs)

- Create multiple configs for different streaming scenarios
- Add/remove widgets from each config
- Only one config can be active at a time
- Widgets can be reused across configs with different settings

### OBS Integration

1. **Start OBS Studio**
2. **Enable OBS VirtualCam** or **NDI output**
3. **In BYTE Frames**:
   - Go to Control panel
   - Connect to OBS WebSocket (if using)
   - Select VirtualCam from video source dropdown
   - Click "Bind" to preview

### Previewing Overlays

- **Apply** button: Preview widgets in the app
- **Clear** button: Remove preview
- **Export** button: Generate HTML overlay for OBS Browser Source (coming soon)

## Project Structure

```
byteframes/
├── main.go                 # Wails entry point
├── app.go                  # Go backend application logic
├── internal/
│   └── db/
│       ├── db.go          # Database initialization
│       └── schema.sql     # SQL schema definition
├── frontend/
│   ├── src/
│   │   ├── App.tsx        # Main React component
│   │   ├── components/    # UI components
│   │   ├── db/            # Database adapter & queries
│   │   ├── obs/           # OBS WebSocket integration
│   │   ├── overlay/       # Widget runtime engine
│   │   └── types/         # TypeScript definitions
│   ├── wailsjs/          # Generated Wails bindings (auto)
│   └── package.json
├── build/                 # Build output (gitignored)
└── port/                  # Original web app (reference)
```

## Tech Stack

### Backend
- **Wails v2**: Go + Web UI framework
- **Go 1.21+**: Backend language
- **SQLite**: Native database (modernc.org/sqlite)

### Frontend
- **React 19**: UI framework
- **TypeScript**: Type safety
- **Vite**: Build tool & dev server
- **Monaco Editor**: Code editing
- **React Mosaic**: Panel layout system
- **obs-websocket-js**: OBS integration
- **Tailwind CSS v4**: Styling

## Permissions

BYTE Frames requires the following macOS permissions:

- **Camera Access**: For OBS VirtualCam/NDI preview
- **Microphone Access**: For OBS audio integration (optional)

Permissions are requested on first use.

## Troubleshooting

### Database Issues
If you encounter database errors:
```bash
rm byteframes.db*  # Delete database files
wails dev          # Restart - fresh DB will be created
```

### Build Errors
```bash
# Clean build cache
wails build -clean

# Regenerate bindings
wails generate module
```

### Frontend Issues
```bash
cd frontend
rm -rf node_modules
bun install  # or npm install
cd ..
```

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Roadmap

- [ ] HTML export for OBS Browser Source
- [ ] Drag-and-drop widget positioning
- [ ] Widget templates library
- [ ] Multi-monitor support
- [ ] Windows/Linux builds
- [ ] Plugin system
- [ ] Collaborative widget sharing

## License

MIT License - see [LICENSE](LICENSE) file for details

## Acknowledgments

- Built with [Wails](https://wails.io/)
- OBS integration via [obs-websocket-js](https://github.com/obs-websocket-community-projects/obs-websocket-js)
- Code editing powered by [Monaco Editor](https://microsoft.github.io/monaco-editor/)

---

**Made with ❤️ for the streaming community**
