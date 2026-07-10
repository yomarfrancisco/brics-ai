"use client"
// Build: v140

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { TreePalm, House, Calendar, HandCoins, ChartNoAxesColumn, Star, TowerControl, AlertTriangle, MessageCircle, ThumbsUp } from "lucide-react"

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ""

// Map component with operator dot, buyer pin, and route
// Checkpoint-based map: shows only active leg (operator → destination)
function MapBackground({ operatorLat, operatorLng, destLat, destLng, destName, dotColor = "green" }: { 
  operatorLat: number, operatorLng: number, destLat: number, destLng: number, destName: string, dotColor?: "green" | "blue" | "amber"
}) {
  const dotRgb = dotColor === "blue" ? "59, 130, 246" : dotColor === "amber" ? "245, 158, 11" : "34, 197, 94"
  const dotHex = dotColor === "blue" ? "#3b82f6" : dotColor === "amber" ? "#f59e0b" : "#22c55e"
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const destMarker = useRef<mapboxgl.Marker | null>(null)
  const isInitializing = useRef(false)
  
  useEffect(() => {
    if (!mapContainer.current || map.current || isInitializing.current) return
    isInitializing.current = true
    
    import("mapbox-gl").then(async (mapboxgl) => {
      mapboxgl.default.accessToken = MAPBOX_TOKEN
      
      // Center between operator and destination
      const centerLng = (operatorLng + destLng) / 2
      const centerLat = (operatorLat + destLat) / 2
      
      map.current = new mapboxgl.default.Map({
        container: mapContainer.current!,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [centerLng, centerLat],
        zoom: 12,
        interactive: false
      })
      
      map.current.on("load", async () => {
        if (!map.current) return
        
        // Create pulsing dot images for both colors
        const createPulsingDot = (rgb: string, hex: string) => {
          const pulseSize = 100
          return {
            width: pulseSize,
            height: pulseSize,
            data: new Uint8Array(pulseSize * pulseSize * 4),
            context: null as CanvasRenderingContext2D | null,
            onAdd: function() {
              const canvas = document.createElement("canvas")
              canvas.width = this.width
              canvas.height = this.height
              this.context = canvas.getContext("2d")
            },
            render: function() {
              const duration = 1500
              const t = (performance.now() % duration) / duration
              const radius = (pulseSize / 2) * 0.3
              const outerRadius = (pulseSize / 2) * 0.7 * t + radius
              const ctx = this.context
              if (!ctx) return false
              
              ctx.clearRect(0, 0, this.width, this.height)
              
              // Outer pulsing circle
              ctx.beginPath()
              ctx.arc(this.width / 2, this.height / 2, outerRadius, 0, Math.PI * 2)
              ctx.fillStyle = `rgba(${rgb}, ${1 - t})`
              ctx.fill()
              
              // Inner solid circle
              ctx.beginPath()
              ctx.arc(this.width / 2, this.height / 2, radius, 0, Math.PI * 2)
              ctx.fillStyle = hex
              ctx.strokeStyle = "#fff"
              ctx.lineWidth = 2
              ctx.fill()
              ctx.stroke()
              
              this.data = ctx.getImageData(0, 0, this.width, this.height).data as unknown as Uint8Array
              map.current?.triggerRepaint()
              return true
            }
          }
        }
        
        // Add pulsing dot image based on dotColor
        const dotImageName = `pulsing-dot-${dotColor}`
        if (!map.current.hasImage(dotImageName)) {
          map.current.addImage(dotImageName, createPulsingDot(dotRgb, dotHex) as mapboxgl.StyleImageInterface, { pixelRatio: 2 })
        }
        
        // Add operator dot with current color
        if (!map.current.getSource("operator")) {
          map.current.addSource("operator", {
            type: "geojson",
            data: { type: "Point", coordinates: [operatorLng, operatorLat] }
          })
          map.current.addLayer({
            id: "operator",
            type: "symbol",
            source: "operator",
            layout: { "icon-image": dotImageName, "icon-allow-overlap": true }
          })
        }
        
        // Add destination pin with label
        if (!destMarker.current) {
          const container = document.createElement("div")
          container.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:4px;"
          
          const pin = document.createElement("div")
          pin.style.cssText = "width:20px;height:20px;background:#f59e0b;border:2px solid #fff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 6px rgba(0,0,0,0.3);"
          
          const label = document.createElement("div")
          label.style.cssText = "font-size:9px;font-family:ui-monospace,monospace;color:rgba(255,255,255,0.8);white-space:nowrap;letter-spacing:0.05em;text-align:center;"
          label.textContent = destName
          
          container.appendChild(pin)
          container.appendChild(label)
          
          destMarker.current = new mapboxgl.default.Marker(container)
            .setLngLat([destLng, destLat])
            .addTo(map.current)
        }
        
        // Draw route immediately (for all cases)
        try {
          const response = await fetch(
            `https://api.mapbox.com/directions/v5/mapbox/driving/${operatorLng},${operatorLat};${destLng},${destLat}?geometries=geojson&access_token=${MAPBOX_TOKEN}`
          )
          const data = await response.json()
          
          if (data.routes && data.routes[0] && !map.current.getSource("route")) {
            map.current.addSource("route", {
              type: "geojson",
              data: { type: "Feature", properties: {}, geometry: data.routes[0].geometry }
            })
            map.current.addLayer({
              id: "route-glow",
              type: "line",
              source: "route",
              layout: { "line-join": "round", "line-cap": "round" },
              paint: { "line-color": "#f59e0b", "line-width": 8, "line-opacity": 0.3, "line-blur": 4 }
            })
            map.current.addLayer({
              id: "route",
              type: "line",
              source: "route",
              layout: { "line-join": "round", "line-cap": "round" },
              paint: { "line-color": "#f59e0b", "line-width": 3, "line-opacity": 0.9 }
            })
            
            const coordinates = data.routes[0].geometry.coordinates
            const bounds = coordinates.reduce((bounds: mapboxgl.LngLatBounds, coord: [number, number]) => {
              return bounds.extend(coord)
            }, new mapboxgl.default.LngLatBounds(coordinates[0], coordinates[0]))
            
            map.current.fitBounds(bounds, { 
              padding: { top: 80, bottom: 380, left: 40, right: 40 }
            })
          }
        } catch (e) {
          // Fallback if route fetch fails
        }
      })
    })
    
    return () => {
      if (destMarker.current) {
        destMarker.current.remove()
        destMarker.current = null
      }
      if (map.current) map.current.remove()
      map.current = null
      isInitializing.current = false
    }
  }, [operatorLat, operatorLng, destLat, destLng, destName, dotColor])
  
  return <div ref={mapContainer} style={{ width:"100%", height:"100%", backgroundColor:"#0a0a0a" }} />
}

// ─── DATA ─────────────────────────────────────────────────────────────────────
const USERS = [
{ id: "ygor", name: "Ygor Omar", role: "principal", pin: "1234" },
{ id: "luizette", name: "Luizette De Santo", role: "partner", pin: "2222", companies: ["Luima Property Solutions", "Ashu & Co", "Bridge Consulting"] },
{ id: "delsie", name: "Delsie Somaes", role: "partner", pin: "3333", companies: ["Imani Beauty Distributors", "Crown Hair International", "Ms Prestige"] },
{ id: "eunice", name: "Eunice Francisco", role: "partner", pin: "4444", companies: ["Medcare Supplies Africa", "Mathosa Property Holdings"] },
{ id: "olinda", name: "Olinda Wachave", role: "partner", pin: "5555", companies: ["Olinda Hospitality Group", "Maria's Garden"] },
{ id: "omar", name: "Omar Luis", role: "partner", pin: "6666", companies: ["Kenny Construction Imports", "Moamba Land and Agri"] },
{ id: "samson", name: "Samson", role: "agent", pin: "7777", cycle: "MON 09:30", agent: "Samson" },
{ id: "luciano", name: "Luciano", role: "agent", pin: "8888", cycle: "TUE 09:30", agent: "Luciano" },
{ id: "antonio", name: "Antonio", role: "agent", pin: "9999", cycle: "MON 13:30", agent: "Antonio" },
] as const

type User = typeof USERS[number]

const ROLE_COLORS: Record<string, string> = { principal: "#888888", partner: "#888888", agent: "#888888" }

const BUYERS = [
  { id: "B01", name: "GP Collections", location: "Menlyn Park, Pretoria", city: "Pretoria", corridor: "ZA", score: 8.4, tier: 1, avgSettlement: 18, weeklyShare: 33, status: "Active", lastUsed: "Today", maxCapacity: "R650k", contact: "Priya Naidoo", phone: "+27 82 441 0022", bankName: "FNB", settled: 47, incidents: 0, lat: -25.786081, lng: 28.283915 },
  { id: "B02", name: "N.D Gold & Money Exchange", location: "Kempton Park, Johannesburg", city: "Johannesburg", corridor: "ZA", score: 7.1, tier: 2, avgSettlement: 34, weeklyShare: 22, status: "Active", lastUsed: "Today", maxCapacity: "R500k", contact: "David Mokoena", phone: "+27 83 512 7743", bankName: "ABSA", settled: 31, incidents: 1, lat: -26.109523, lng: 28.229430 },
  { id: "B03", name: "Interchange FX", location: "Bedfordview, Johannesburg", city: "Johannesburg", corridor: "ZA", score: 6.2, tier: 2, avgSettlement: 48, weeklyShare: 22, status: "Active", lastUsed: "Mon", maxCapacity: "R480k", contact: "Thabo Sithole", phone: "+27 72 883 3311", bankName: "Standard Bank", settled: 22, incidents: 2, lat: -26.188233, lng: 28.122086 },
  { id: "B04", name: "Diamond Dealer", location: "Fordsburg, Johannesburg", city: "Johannesburg", corridor: "ZA", score: 5.1, tier: 3, avgSettlement: 72, weeklyShare: 11, status: "Watch", lastUsed: "Last week", maxCapacity: "R400k", contact: "Rashid Ismail", phone: "+27 84 771 9902", bankName: "Nedbank", settled: 14, incidents: 3, lat: -26.203313, lng: 28.024341 },
  { id: "B05", name: "Private Trader", location: "Marshalltown, Johannesburg", city: "Johannesburg", corridor: "ZA", score: 4.3, tier: 3, avgSettlement: 95, weeklyShare: 11, status: "Active", lastUsed: "Last week", maxCapacity: "R350k", contact: "Omar Cassim", phone: "+27 73 220 8814", bankName: "Capitec", settled: 9, incidents: 4, lat: -26.205411, lng: 28.046280 },
]

type Buyer = typeof BUYERS[number]

const BUYER_COLORS = ["#9ecbb8", "#b8c4d8", "#d8c8b0", "#a8a8a8", "#888888"] // brighter pastels

const ALL_CYCLES = [
  { slot: "MON 09:30", company: "Wolf Digital", director: "Ygor", agent: "Samson", buyerId: "B01", status: "complete", idleTime: 18, margin: 3.4, zar: 450000 },
  { slot: "MON 13:30", company: "Luima Property", director: "Luizette", agent: "Antonio", buyerId: "B02", status: "active", zar: 450000 },
  { slot: "TUE 09:30", company: "Imani Beauty", director: "Delsie", agent: "Luciano", buyerId: "B01", status: "scheduled", zar: 450000 },
  { slot: "TUE 13:30", company: "Crown Hair", director: "Delsie", agent: "Antonio", buyerId: "B03", status: "scheduled", zar: 450000 },
  { slot: "WED 09:30", company: "Ashu & Co", director: "Luizette", agent: "Samson", buyerId: "B02", status: "scheduled", zar: 450000 },
  { slot: "WED 13:30", company: "Goblin Research", director: "Ygor", agent: "Samson", buyerId: "B01", status: "scheduled", zar: 450000 },
  { slot: "THU 09:30", company: "Medcare Supplies", director: "Nucha", agent: "Luciano", buyerId: "B01", status: "scheduled", zar: 450000 },
  { slot: "THU 13:30", company: "Kenny Construction", director: "Omar", agent: "Antonio", buyerId: "B03", status: "scheduled", zar: 450000 },
  { slot: "FRI 09:30", company: "Maria's Garden", director: "Olinda", agent: "Samson", buyerId: "B02", status: "scheduled", zar: 450000 },
]

const COMPANIES = [
  { name: "Wolf Digital", short: "Wolf Digital", director: "Ygor", cumulative: 2340000 },
  { name: "Lemon Creative", short: "Lemon Creative", director: "Ygor", cumulative: 1890000 },
  { name: "Goblin Research Advisory", short: "Goblin Research", director: "Ygor", cumulative: 3120000 },
  { name: "Luima Property Solutions", short: "Luima Property", director: "Luizette", cumulative: 4560000 },
  { name: "Ashu & Co", short: "Ashu & Co", director: "Luizette", cumulative: 2780000 },
  { name: "Bridge Consulting", short: "Bridge Consulting", director: "Luizette", cumulative: 1230000 },
  { name: "Imani Beauty Distributors", short: "Imani Beauty", director: "Delsie", cumulative: 5890000 },
  { name: "Crown Hair International", short: "Crown Hair", director: "Delsie", cumulative: 6340000 },
  { name: "Ms Prestige", short: "Ms Prestige", director: "Delsie", cumulative: 3210000 },
  { name: "Medcare Supplies Africa", short: "Medcare Supplies", director: "Nucha", cumulative: 7890000 },
  { name: "Mathosa Property Holdings", short: "Mathosa Property", director: "Nucha", cumulative: 4560000 },
  { name: "Olinda Hospitality Group", short: "Olinda Hospitality", director: "Olinda", cumulative: 9120000 },
  { name: "Maria's Garden", short: "Maria's Garden", director: "Olinda", cumulative: 13450000 },
  { name: "Kenny Construction Imports", short: "Kenny Construction", director: "Omar", cumulative: 11200000 },
  { name: "Moamba Land and Agri", short: "Moamba Land", director: "Omar", cumulative: 8900000 },
]

function getBuyer(id: string) { return BUYERS.find(b => b.id === id) || BUYERS[0] }

type Cycle = {
  slot: string
  company: string
  director: string
  agent: string
  buyerId: string
  status: string
  idleTime?: number
  margin?: number
  zar: number
  buyer: Buyer
}

function enrichCycle(c: typeof ALL_CYCLES[number]): Cycle {
  return { ...c, buyer: getBuyer(c.buyerId) }
}

const CYCLES = ALL_CYCLES.map(enrichCycle)

// ─── THEME ────────────────────────────────────────────────────────────────────
const C = {
  bg: "#0a0a0a", surface: "#111", surfaceHigh: "#1a1a1a",
  border: "#1f1f1f", borderHigh: "#2e2e2e",
  text: "#ebebeb", textHigh: "#c8c8c8", textMid: "#5a5a5a", textLow: "#4a4a4a",
  green: "#22c55e", amber: "#f59e0b", red: "#ef4444", blue: "#3b82f6",
  }
const mono = "'SF Mono','Fira Code','Consolas',monospace"
const serif = "'Georgia','Times New Roman',serif"

// Hero image URL
const HERO_IMG = "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/pexels-talharesitoglu-36653143-hL4oQZhU6iBvepHzJyScNEX6uS4BsT.jpg"

// ─── UTILS ───────────────────────--─────────--------───────────────-----──────-------──────────
function useTimer() {
  const [ms, setMs] = useState(0)
  const startRef = useRef(Date.now() - 1334000)
  useEffect(() => {
    const interval = setInterval(() => setMs(Date.now() - startRef.current), 50)
    return () => clearInterval(interval)
  }, [])
  const totalSecs = Math.floor(ms / 1000)
  const mins = Math.floor(totalSecs / 60)
  const secs = totalSecs % 60
  const centis = Math.floor((ms % 1000) / 10)
  const formatted = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${centis.toString().padStart(2, '0')}`
  return { mins, secs, formatted }
}

function Tag({ color, children, small }: { color: string; children: React.ReactNode; small?: boolean }) {
  return <span style={{ display:"inline-block", padding: small?"1px 6px":"2px 8px", borderRadius:3, fontSize: small?8:9, letterSpacing:"0.18em", textTransform:"uppercase", backgroundColor:`${color}18`, color, border:`1px solid ${color}30`, fontFamily:mono }}>{children}</span>
}

function Stars({ score, muted }: { score: number; muted?: boolean }) {
  // Convert 10-point score to 5-star scale
  const stars = Math.round(score / 2)
  const fillColor = muted ? "rgba(255,255,255,0.35)" : "#d0d0d0"
  const emptyColor = muted ? "rgba(255,255,255,0.15)" : C.border
  return (
    <span style={{ display:"flex", gap:2 }}>
      {Array.from({length:5}).map((_,i) => (
        <Star key={i} size={12} fill={i < stars ? fillColor : "transparent"} color={i < stars ? fillColor : emptyColor} strokeWidth={1.5} />
      ))}
    </span>
  )
}

function Bar({ pct, color }: { pct: number; color: string }) {
  return <div style={{ height:3, backgroundColor:C.surfaceHigh, borderRadius:2, overflow:"hidden" }}><div style={{ height:"100%", width:`${Math.min(pct,100)}%`, backgroundColor:color, transition:"width 1s linear" }}/></div>
}

function Divider({ margin="0 20px" }: { margin?: string }) {
  return <div style={{ height:1, backgroundColor:C.border, margin }}/>
}

function SectionLabel({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 20px 8px" }}>
    <span style={{ fontSize:9, letterSpacing:"0.22em", color:"#707070", textTransform:"uppercase", fontFamily:mono }}>{children}</span>
    {right && <span style={{ fontSize:10, color:C.textMid, fontFamily:mono }}>{right}</span>}
  </div>
}

function CycleRow({ cycle, onTap, showLocation=false }: { cycle: Cycle; onTap?: (c: Cycle) => void; showLocation?: boolean }) {
  const sc = cycle.status==="complete" ? C.green : cycle.status==="active" ? C.amber : C.border
  return (
    <div onClick={()=>onTap&&onTap(cycle)}
      style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 20px", borderBottom:`1px solid ${C.border}`, cursor:"pointer", transition:"background 0.12s" }}
      onMouseEnter={e=>(e.currentTarget as HTMLDivElement).style.backgroundColor=C.surface}
      onMouseLeave={e=>(e.currentTarget as HTMLDivElement).style.backgroundColor="transparent"}
    >
      <div style={{ width:3, height:44, borderRadius:2, backgroundColor:sc, flexShrink:0 }}/>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ fontSize:10, color:C.textMid, fontFamily:mono }}>{cycle.slot}</span>
          <Stars score={cycle.buyer.score}/>
        </div>
        <div style={{ fontSize:13, fontWeight:500, marginTop:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", color:C.text }}>{cycle.company}</div>
        <div style={{ fontSize:10, color:C.textMid, marginTop:2, fontFamily:mono }}>
          {cycle.buyer.name}
          {showLocation && <span style={{ color:C.textLow }}> · {cycle.buyer.location}</span>}
        </div>
      </div>
      <div style={{ flexShrink:0, textAlign:"right" }}>
        {cycle.status==="complete" && <span style={{ fontSize:12, color:C.green, fontFamily:mono }}>{cycle.idleTime}m</span>}
        {cycle.status==="active" && <Tag color={C.amber}>Live</Tag>}
        {cycle.status==="scheduled" && <span style={{ fontSize:11, color:C.textLow }}>›</span>}
      </div>
    </div>
  )
}

// ─── LANDING ──────────────────────────────────────────────────────────────────
 function Landing({ onLogin }: { onLogin: () => void }) {
  const [v, setV] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)
  useEffect(() => { setTimeout(() => setV(true), 80) }, [])
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])
  const fade = (d: number): React.CSSProperties => ({ opacity:v?1:0, transform:v?"none":"translateY(14px)", transition:`all 1.2s cubic-bezier(0.16,1,0.3,1) ${d}s` })

  return (
    <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", fontFamily:serif, position:"relative", overflow:"hidden", backgroundColor:"#060a06" }}>

      {/* Full-bleed hero image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={HERO_IMG}
        alt=""
        style={{
          position:"absolute", inset:0, zIndex:0,
          width:"100%", height:"100%",
          objectFit:"cover", objectPosition:"center 30%",
          filter:"brightness(0.52) saturate(0.75)",
          pointerEvents:"none",
        }}
      />

      {/* Gradient overlay — dark at bottom for text legibility */}
      <div style={{
        position:"absolute", inset:0, zIndex:1,
        background:"linear-gradient(to bottom, rgba(6,10,6,0.18) 0%, rgba(6,10,6,0.08) 40%, rgba(6,10,6,0.68) 72%, rgba(6,10,6,0.90) 100%)",
      }}/>

      {/* Nav */}
      <div style={{ ...fade(0), display:"flex", justifyContent:"space-between", alignItems:"center", padding:"28px 28px 24px", position:"relative", zIndex:3 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <TreePalm size={18} style={{ color:"rgba(255,255,255,0.88)" }} />
          <span style={{ fontSize:13, letterSpacing:"0.22em", color:"rgba(255,255,255,0.88)", fontFamily:mono, textTransform:"uppercase", fontWeight:500 }}>BRICS AI</span>
        </div>
        <button onClick={onLogin} disabled style={{ display:"none", background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.22)", borderRadius:3, padding:"8px 18px", color:"rgba(255,255,255,0.75)", fontSize:10, letterSpacing:"0.18em", textTransform:"uppercase", cursor:"pointer", fontFamily:mono, transition:"all 0.25s", backdropFilter:"blur(8px)" }}
          onMouseEnter={e=>{(e.target as HTMLButtonElement).style.background="rgba(255,255,255,0.16)";(e.target as HTMLButtonElement).style.color="#fff";}}
          onMouseLeave={e=>{(e.target as HTMLButtonElement).style.background="rgba(255,255,255,0.08)";(e.target as HTMLButtonElement).style.color="rgba(255,255,255,0.75)";}}
        >Log in</button>
      </div>

      {/* Spacer — pushes text to bottom */}
      <div style={{ flex:1, position:"relative", zIndex:3 }}/>

      {/* Hero text — bottom anchored, editorial scale */}
      <div style={{ padding:"0 28px 48px", position:"relative", zIndex:3 }}>
        <div style={{ ...fade(0.3), width:32, height:1, backgroundColor:"rgba(255,255,255,0.3)", marginBottom:28 }}/>
        <p style={{ ...fade(0.45), fontSize: isDesktop ? 32 : 27, lineHeight:1.45, color:"rgba(255,255,255,0.92)", margin:"0 0 20px", fontWeight:400, letterSpacing:"-0.01em", maxWidth: isDesktop ? 600 : 340 }}>
          A software development firm focused on AI infrastructure development in Southern Africa.
        </p>
        <div style={{ ...fade(0.65) }}>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.42)", fontFamily:mono, letterSpacing:"0.12em", lineHeight:1.9 }}>
            Johannesburg, South Africa<br/>Est. 2026
          </div>
          <div style={{ width:"100%", height:1, backgroundColor:"rgba(255,255,255,0.15)", margin:"16px 0" }}/>
          <Link href="/legal" style={{ display:"block", fontSize:9, color:"rgba(255,255,255,0.42)", fontFamily:mono, width:"100%", textAlign:"left", cursor:"pointer", letterSpacing:"0.04em", textDecoration:"underline", textUnderlineOffset:"3px", transition:"color 0.25s" }}
            onMouseEnter={e=>{(e.currentTarget as HTMLAnchorElement).style.color="rgba(255,255,255,0.7)";}}
            onMouseLeave={e=>{(e.currentTarget as HTMLAnchorElement).style.color="rgba(255,255,255,0.42)";}}
          >
            Terms and conditions, shipping policy and refund policy
          </Link>
        </div>
      </div>
    </div>
  )
}

// ─── USER SELECT ─────────────────────────────────────────────────────────────
function UserSelect({ onSelect, onBack }: { onSelect: (u: User) => void; onBack: () => void }) {
  const [v, setV] = useState(false)
  useEffect(() => { setTimeout(() => setV(true), 80) }, [])
  const fade = (d: number): React.CSSProperties => ({ opacity:v?1:0, transform:v?"none":"translateY(14px)", transition:`all 1.2s cubic-bezier(0.16,1,0.3,1) ${d}s` })
  const groups = [
    { role: "principal", label: "Principal" },
    { role: "partner", label: "Partners" },
    { role: "agent", label: "Agents" }
  ]
  return (
    <div style={{ position:"relative", minHeight:"100vh", fontFamily:mono, color:C.text }}>
      {/* Backdrop with 90% overlay */}
      <div style={{ position:"absolute", inset:0, zIndex:0 }}>
        <img src={HERO_IMG} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
        <div style={{ position:"absolute", inset:0, backgroundColor:"rgba(0,0,0,0.90)" }} />
      </div>
      {/* Content */}
      <div style={{ position:"relative", zIndex:1 }}>
        <div style={{ ...fade(0), display:"flex", alignItems:"center", justifyContent:"space-between", padding:"28px 28px 24px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <TreePalm size={18} style={{ color:"rgba(255,255,255,0.88)" }} />
            <span style={{ fontSize:13, letterSpacing:"0.22em", color:"rgba(255,255,255,0.88)", fontFamily:mono, textTransform:"uppercase", fontWeight:500 }}>YXK</span>
          </div>
          <button onClick={onBack} style={{ background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.22)", borderRadius:3, padding:"8px 18px", color:"rgba(255,255,255,0.75)", fontSize:10, letterSpacing:"0.18em", textTransform:"uppercase", cursor:"pointer", fontFamily:mono, transition:"all 0.25s", backdropFilter:"blur(8px)" }}
            onMouseEnter={e=>{(e.target as HTMLButtonElement).style.background="rgba(255,255,255,0.16)";(e.target as HTMLButtonElement).style.color="#fff";}}
            onMouseLeave={e=>{(e.target as HTMLButtonElement).style.background="rgba(255,255,255,0.08)";(e.target as HTMLButtonElement).style.color="rgba(255,255,255,0.75)";}}
          >Close</button>
        </div>
        <div style={{ padding:"0 28px 48px", marginTop:"20vh" }}>
          {/* Short divider line above content */}
          <div style={{ ...fade(0.3), width:32, height:1, backgroundColor:"rgba(255,255,255,0.3)", marginBottom:28 }}/>
          {groups.map((g, gi) => {
            const users = USERS.filter(u => u.role === g.role)
            if (users.length === 0) return null
            return (
              <div key={g.role} style={{ ...fade(0.4 + gi * 0.15), marginBottom: gi < groups.length - 1 ? 28 : 0 }}>
                <div style={{ fontSize:9, letterSpacing:"0.35em", color:"rgba(255,255,255,0.42)", textTransform:"uppercase", marginBottom:10 }}>{g.label}</div>
                {users.map(user => (
                  <div key={user.id} onClick={() => onSelect(user as User)}
                    style={{ padding:"8px 0", cursor:"pointer" }}
                    onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.color = "rgba(255,255,255,1)"}
                    onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.color = "rgba(255,255,255,0.88)"}
                  >
                    <span style={{ fontSize:16, color:"rgba(255,255,255,0.88)", fontWeight:400, fontFamily:serif }}>{user.name}</span>
                  </div>
                ))}
              </div>
            )
          })}
          {/* Footer divider and disclaimer */}
          <div style={{ ...fade(0.85), width:"100%", height:1, backgroundColor:"rgba(255,255,255,0.15)", margin:"32px 0 16px" }}/>
          <div style={{ ...fade(0.95), fontSize:9, color:"rgba(255,255,255,0.25)", fontFamily:mono }}>
            YXK does not broadly solicit investment.
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── PIN ENTRY ────────────────────────────────────────────────────────────────
function PinEntry({ user, onSuccess, onBack }: { user: User; onSuccess: (u: User) => void; onBack: () => void }) {
  const [pin, setPin] = useState("")
  const [shake, setShake] = useState(false)
  const [v, setV] = useState(false)
  useEffect(() => { setTimeout(() => setV(true), 80) }, [])
  const fade = (d: number): React.CSSProperties => ({ opacity:v?1:0, transform:v?"none":"translateY(14px)", transition:`all 1.2s cubic-bezier(0.16,1,0.3,1) ${d}s` })
  const digit = (d: string) => {
    if (pin.length >= 4) return
    const next = pin + d
    setPin(next)
    if (next.length === 4) {
      setTimeout(() => {
        if (next === user.pin) { onSuccess(user) }
        else { setShake(true); setTimeout(() => { setShake(false); setPin("") }, 600) }
      }, 200)
    }
  }
  return (
    <div style={{ position:"relative", minHeight:"100vh", fontFamily:mono, display:"flex", flexDirection:"column", color:C.text }}>
      <style>{`@keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-7px)}40%{transform:translateX(7px)}60%{transform:translateX(-5px)}80%{transform:translateX(5px)}}`}</style>
      {/* Backdrop with 94% overlay */}
      <div style={{ position:"absolute", inset:0, zIndex:0 }}>
        <img src={HERO_IMG} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
        <div style={{ position:"absolute", inset:0, backgroundColor:"rgba(0,0,0,0.94)" }} />
      </div>
      {/* Content */}
      <div style={{ position:"relative", zIndex:1, display:"flex", flexDirection:"column", flex:1 }}>
        <div style={{ ...fade(0), display:"flex", alignItems:"center", justifyContent:"space-between", padding:"28px 28px 24px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <TreePalm size={18} style={{ color:"rgba(255,255,255,0.88)" }} />
            <span style={{ fontSize:13, letterSpacing:"0.22em", color:"rgba(255,255,255,0.88)", fontFamily:mono, textTransform:"uppercase", fontWeight:500 }}>YXK</span>
          </div>
          <button onClick={onBack} style={{ background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.22)", borderRadius:3, padding:"8px 18px", color:"rgba(255,255,255,0.75)", fontSize:10, letterSpacing:"0.18em", textTransform:"uppercase", cursor:"pointer", fontFamily:mono, transition:"all 0.25s", backdropFilter:"blur(8px)" }}
            onMouseEnter={e=>{(e.target as HTMLButtonElement).style.background="rgba(255,255,255,0.16)";(e.target as HTMLButtonElement).style.color="#fff";}}
            onMouseLeave={e=>{(e.target as HTMLButtonElement).style.background="rgba(255,255,255,0.08)";(e.target as HTMLButtonElement).style.color="rgba(255,255,255,0.75)";}}
          >Back</button>
        </div>
        <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"0 28px 40px" }}>
          <div style={{ ...fade(0.2), width:56, height:56, borderRadius:"50%", backgroundColor:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.12)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, fontWeight:400, color:"rgba(255,255,255,0.5)", marginBottom:16 }}>{user.name.charAt(0)}</div>
          <div style={{ ...fade(0.25), fontSize:16, color:"rgba(255,255,255,0.92)", marginBottom:6, fontFamily:serif }}>{user.name}</div>
          <div style={{ ...fade(0.3), fontSize:9, letterSpacing:"0.35em", color:"rgba(255,255,255,0.42)", textTransform:"uppercase" }}>{user.role}</div>
          <div style={{ ...fade(0.4), display:"flex", gap:16, margin:"40px 0 44px", animation:shake?"shake 0.5s ease":"none" }}>
            {[0,1,2,3].map(i=>(
              <div key={i} style={{ width:12, height:12, borderRadius:"50%", backgroundColor:i<pin.length?"rgba(255,255,255,0.8)":"transparent", border:`1.5px solid ${i<pin.length?"rgba(255,255,255,0.8)":"rgba(255,255,255,0.25)"}`, transition:"all 0.15s" }}/>
            ))}
          </div>
          <div style={{ ...fade(0.5), display:"grid", gridTemplateColumns:"repeat(3, 72px)", gap:10 }}>
            {[1,2,3,4,5,6,7,8,9].map(d=>(
              <button key={d} onClick={()=>digit(String(d))} style={{ backgroundColor:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:"17px 0", fontSize:20, color:"rgba(255,255,255,0.8)", cursor:"pointer", fontFamily:mono, fontWeight:300, transition:"all 0.15s" }}
                onMouseDown={e=>(e.currentTarget as HTMLButtonElement).style.backgroundColor="rgba(255,255,255,0.12)"}
                onMouseUp={e=>(e.currentTarget as HTMLButtonElement).style.backgroundColor="rgba(255,255,255,0.04)"}
              >{d}</button>
            ))}
            <div/>
            <button onClick={()=>digit("0")} style={{ backgroundColor:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:"17px 0", fontSize:20, color:"rgba(255,255,255,0.8)", cursor:"pointer", fontFamily:mono, transition:"all 0.15s" }}
              onMouseDown={e=>(e.currentTarget as HTMLButtonElement).style.backgroundColor="rgba(255,255,255,0.12)"}
              onMouseUp={e=>(e.currentTarget as HTMLButtonElement).style.backgroundColor="rgba(255,255,255,0.04)"}
            >0</button>
            <button onClick={()=>setPin(p=>p.slice(0,-1))} style={{ background:"none", border:"none", padding:"17px 0", fontSize:18, color:"rgba(255,255,255,0.4)", cursor:"pointer" }}>&#x232B;</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── INCIDENT MODE ────────────────────────────--───────────────────────────────
function IncidentMode({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0)
  const [pt, setPt] = useState(7200)
  useEffect(() => { const t = setInterval(()=>setPt(p=>Math.max(0,p-1)),1000); return ()=>clearInterval(t) }, [])
  const steps = [
    { title:"Secure personal safety", body:"Ensure your immediate safety before any other action." },
    { title:"Notify director immediately", body:"Send WhatsApp to Ygor Omar Francisco now.\nState: Loss Event, amount, location." },
    { title:"Contact SAPS", body:"Obtain case number within 2 hours.", timer:true },
    { title:"Preserve all evidence", body:"Do not delete any messages, photos, or records." },
    { title:"Notify insurer", body:"Same business day deadline. Case number, amount, incident details." },
    { title:"Complete incident report", body:"Open Handover Receipt & Incident Form.\nComplete Loss Event section in full." },
  ]
  return (
    <div style={{ position:"fixed", inset:0, backgroundColor:"#0d0000", zIndex:500, maxWidth:420, margin:"0 auto", display:"flex", flexDirection:"column", fontFamily:mono }}>
      <div style={{ backgroundColor:"#4a0000", padding:"18px 20px", display:"flex", justifyContent:"space-between" }}>
        <div>
          <div style={{ fontSize:9, letterSpacing:"0.22em", color:"#f87171" }}>INCIDENT MODE</div>
          <div style={{ fontSize:13, fontWeight:600, color:"#fecaca", marginTop:2 }}>Loss Event — Active Cycle</div>
        </div>
        <div style={{ textAlign:"right" }}>
          <div style={{ fontSize:9, color:"#f87171" }}>OWNER</div>
          <div style={{ fontSize:11, color:"#fecaca" }}>Ygor Francisco</div>
        </div>
      </div>
      <div style={{ padding:"20px 20px 0", display:"flex", gap:4 }}>
        {steps.map((_,i)=><div key={i} style={{ flex:1, height:3, borderRadius:1, backgroundColor:i<=step?C.red:"#1a0000" }}/>)}
      </div>
      <div style={{ flex:1, padding:"24px 20px", overflow:"auto" }}>
        <div style={{ fontSize:9, letterSpacing:"0.2em", color:"#f87171" }}>STEP {step+1} OF {steps.length}</div>
        <div style={{ fontSize:22, fontWeight:600, color:"#fef2f2", marginTop:8, lineHeight:1.3 }}>{steps[step].title}</div>
        <div style={{ fontSize:13, color:"#555", marginTop:14, lineHeight:1.8, whiteSpace:"pre-line" }}>{steps[step].body}</div>
        {steps[step].timer && (
          <div style={{ textAlign:"center", marginTop:24 }}>
            <div style={{ fontSize:52, fontWeight:700, color:pt<1800?C.red:C.amber, fontVariantNumeric:"tabular-nums" }}>
              {String(Math.floor(pt/3600)).padStart(2,"0")}:{String(Math.floor((pt%3600)/60)).padStart(2,"0")}:{String(pt%60).padStart(2,"0")}
            </div>
            {step===2&&<div style={{ marginTop:16 }}>
              <input placeholder="Case number..." style={{ width:"100%", backgroundColor:"#1a0000", border:"1px solid #2a0000", borderRadius:6, padding:"12px", color:"#fecaca", fontSize:12, fontFamily:mono, boxSizing:"border-box", marginBottom:8 }}/>
              <input placeholder="Police station..." style={{ width:"100%", backgroundColor:"#1a0000", border:"1px solid #2a0000", borderRadius:6, padding:"12px", color:"#fecaca", fontSize:12, fontFamily:mono, boxSizing:"border-box" }}/>
            </div>}
          </div>
        )}
      </div>
      <div style={{ padding:"16px 20px 32px", display:"flex", gap:10 }}>
        {step>0&&<button onClick={()=>setStep(s=>s-1)} style={{ flex:1, backgroundColor:"#1a0000", border:"1px solid #2a0000", borderRadius:8, padding:"14px", fontSize:10, letterSpacing:"0.15em", color:"#555", cursor:"pointer", fontFamily:mono }}>← BACK</button>}
        {step<steps.length-1
          ?<button onClick={()=>setStep(s=>s+1)} style={{ flex:2, backgroundColor:C.red, border:"none", borderRadius:8, padding:"14px", fontSize:10, letterSpacing:"0.15em", color:"#fff", cursor:"pointer", fontFamily:mono }}>MARK COMPLETE →</button>
          :<button onClick={onClose} style={{ flex:2, backgroundColor:C.red, border:"none", borderRadius:8, padding:"14px", fontSize:10, letterSpacing:"0.15em", color:"#fff", cursor:"pointer", fontFamily:mono }}>CLOSE INCIDENT</button>
        }
      </div>
    </div>
  )
}

// ─── BUYER DETAIL ───────--─────────────────────────────────────────────────────
function BuyerDetail({ buyer, onBack }: { buyer: Buyer; onBack: () => void }) {
  const color = buyer.score>=8?C.green:buyer.score>=6?C.amber:C.red
  return (
    <>
      {/* Backdrop overlay - tap to dismiss, semi-transparent to show map */}
      <div 
        onClick={onBack}
        style={{ position:"fixed", inset:0, zIndex:100, backgroundColor:"rgba(0,0,0,0.3)" }}
      />
      
      {/* Bottom sheet - matches CycleDetail style */}
      <div style={{ 
        position:"fixed", 
        bottom:90, 
        left:"50%",
        transform:"translateX(-50%)",
        width:"calc(100% - 40px)",
        maxWidth:380,
        zIndex:101,
        backgroundColor:"rgba(0,0,0,0.92)", 
        backdropFilter:"blur(20px)", 
        borderRadius:12,
        border:"1px solid rgba(255,255,255,0.1)",
        maxHeight:"70vh",
        overflow:"auto",
        fontFamily:mono,
        color:C.text
      }}>
        <div style={{ padding:"28px 24px 32px" }}>
          {/* Header: Buyer name with stars */}
          <div style={{ marginBottom:24 }}>
            <div style={{ fontSize:24, fontWeight:400, color:C.textHigh, fontFamily:serif }}>{buyer.name}</div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:8 }}>
              <Stars score={buyer.score} muted />
              <span style={{ fontSize:11, color:C.textMid }}>{buyer.location}</span>
            </div>
          </div>
          
          {/* Score + Tier row */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16 }}>
            <div style={{ backgroundColor:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:14 }}>
              <div style={{ fontSize:9, letterSpacing:"0.35em", color:"rgba(255,255,255,0.5)", textTransform:"uppercase" }}>Score</div>
              <div style={{ fontSize:28, fontWeight:400, color, marginTop:6, fontFamily:serif }}>{buyer.score}</div>
            </div>
            <div style={{ backgroundColor:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:14 }}>
              <div style={{ fontSize:9, letterSpacing:"0.35em", color:"rgba(255,255,255,0.5)", textTransform:"uppercase" }}>Tier</div>
              <div style={{ fontSize:28, fontWeight:400, color:C.textHigh, marginTop:6, fontFamily:serif }}>{buyer.tier}</div>
            </div>
          </div>
          
          {/* Stats grid */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16 }}>
            <div style={{ backgroundColor:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:14 }}>
              <div style={{ fontSize:9, letterSpacing:"0.35em", color:"rgba(255,255,255,0.5)", textTransform:"uppercase" }}>Avg Settlement</div>
              <div style={{ fontSize:22, fontWeight:400, color:buyer.avgSettlement<20?C.green:buyer.avgSettlement<40?C.amber:C.red, marginTop:6, fontFamily:serif }}>{buyer.avgSettlement} min</div>
            </div>
            <div style={{ backgroundColor:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:14 }}>
              <div style={{ fontSize:9, letterSpacing:"0.35em", color:"rgba(255,255,255,0.5)", textTransform:"uppercase" }}>Weekly Share</div>
              <div style={{ fontSize:22, fontWeight:400, color:C.textHigh, marginTop:6, fontFamily:serif }}>{buyer.weeklyShare}%</div>
            </div>
            <div style={{ backgroundColor:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:14 }}>
              <div style={{ fontSize:9, letterSpacing:"0.35em", color:"rgba(255,255,255,0.5)", textTransform:"uppercase" }}>Max Capacity</div>
              <div style={{ fontSize:22, fontWeight:400, color:C.textHigh, marginTop:6, fontFamily:serif }}>{buyer.maxCapacity}</div>
            </div>
            <div style={{ backgroundColor:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:14 }}>
              <div style={{ fontSize:9, letterSpacing:"0.35em", color:"rgba(255,255,255,0.5)", textTransform:"uppercase" }}>Cycles Settled</div>
              <div style={{ fontSize:22, fontWeight:400, color:C.green, marginTop:6, fontFamily:serif }}>{buyer.settled}</div>
            </div>
          </div>
          
          {/* Contact info */}
          <div style={{ marginBottom:16 }}>
            {[
              ["Primary", buyer.contact],
              ["Phone", buyer.phone, C.blue],
              ["Bank", buyer.bankName],
            ].map(([label, value, col])=>(
              <div key={label as string} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
                <span style={{ fontSize:11, color:C.textMid }}>{label}</span>
                <span style={{ fontSize:12, color:(col as string) || C.textHigh }}>{value}</span>
              </div>
            ))}
          </div>
          
          {/* Incidents tile */}
          <div style={{ backgroundColor:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:14 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ fontSize:9, letterSpacing:"0.35em", color:"rgba(255,255,255,0.5)", textTransform:"uppercase" }}>Incidents</div>
              <div style={{ fontSize:22, fontWeight:400, color: buyer.incidents === 0 ? C.green : buyer.incidents > 2 ? C.red : C.amber, fontFamily:serif }}>
                {buyer.incidents}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── CYCLE DETAIL ─────────────────────────────────────────────────────────────
function CycleDetail({ cycle, onBack, onBuyerTap, onIncident, timerData, leg }: { cycle: Cycle; onBack: () => void; onBuyerTap?: (b: Buyer) => void; onIncident?: () => void; timerData: { mins: number; secs: number; formatted: string }; leg: 1 | 2 }) {
  const { mins, secs, formatted } = timerData
  const tc = mins<20?C.green:mins<30?C.amber:C.red
  const [checks, setChecks] = useState([false,false,false,false,false,false,false,false,false,false])
  const [cycleStatus, setCycleStatus] = useState<"dispatched"|"arrived"|"exchanged"|"returning">("arrived")
  const allDone = checks.every(Boolean)

  const checkItems = [
    "Advance notice sent to Inter Africa",
    "Acknowledgment received",
    `Agent confirmed — ${cycle.agent}`,
    "Agent ID current",
    "Primary buyer confirmed — rate and amount",
    "Backup buyer identified",
    "Backup buyer score above minimum",
    "Cumulative exchange below R18M",
    "Available capital sufficient",
    "No active incident on this company",
  ]

  // Vertical timeline with segment times
  const timelineSteps = [
    { id: "hq", label: "HQ", time: "—", done: true, active: false },
    { id: "seller", label: "Inter Africa", time: "12:34", done: cycleStatus !== "dispatched", active: cycleStatus === "dispatched" },
    { id: "buyer", label: cycle.buyer.name, time: cycleStatus === "arrived" ? `${String(mins).padStart(2,"0")}:${String(secs).padStart(2,"0")}` : "—", done: cycleStatus === "exchanged" || cycleStatus === "returning", active: cycleStatus === "arrived" },
    { id: "return", label: "HQ", time: "—", done: false, active: cycleStatus === "exchanged" || cycleStatus === "returning" },
  ]

  const openWhatsApp = () => {
    const phone = cycle.buyer.phone?.replace(/\s/g, "") || ""
    const message = encodeURIComponent(`Hi ${cycle.buyer.contact}, following up on the exchange. Please confirm status.`)
    window.open(`https://wa.me/${phone}?text=${message}`, "_blank")
  }

  return (
    <>
      {/* Backdrop overlay - tap to dismiss, semi-transparent to show map */}
      <div 
        onClick={onBack}
        style={{ position:"fixed", inset:0, zIndex:100, backgroundColor:"rgba(0,0,0,0.3)" }}
      />
      
      {/* Bottom sheet - matches home tile width */}
      <div style={{ 
        position:"fixed", 
        bottom:90, 
        left:"50%",
        transform:"translateX(-50%)",
        width:"calc(100% - 40px)",
        maxWidth:380,
        zIndex:101,
        backgroundColor:"rgba(0,0,0,0.75)", 
        backdropFilter:"blur(20px)", 
        borderRadius:12,
        border:"1px solid rgba(255,255,255,0.1)",
        maxHeight:"70vh",
        overflow:"auto",
        fontFamily:mono,
        color:C.text
      }}>
        <div style={{ padding:"28px 24px 32px" }}>
          {/* ACTIVE */}
          {cycle.status==="active"&&<>
            {/* Header: Contact name, company with rating */}
            <div style={{ marginBottom:28 }}>
              <div style={{ fontSize:24, fontWeight:400, color:C.textHigh, fontFamily:serif }}>{cycle.buyer.contact || "David Mokoena"}</div>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginTop:6 }}>
                <span style={{ fontSize:11, color:C.textMid }}>{cycle.buyer.name}</span>
                <Stars score={cycle.buyer.score} muted />
              </div>
            </div>

            {/* Simplified timeline - no connecting lines */}
            <div style={{ marginBottom:32 }}>
              {timelineSteps.map((step) => (
                <div key={step.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                    <div style={{ 
                      width:8, height:8, borderRadius:"50%", 
                      backgroundColor: step.done ? C.green : step.active ? C.amber : "transparent",
                      border: step.done || step.active ? "none" : "1.5px solid rgba(255,255,255,0.2)"
                    }} />
                    <span style={{ fontSize:13, color: step.done || step.active ? C.textHigh : C.textLow }}>{step.label}</span>
                  </div>
                  <span style={{ 
                    fontSize:13, 
                    fontVariantNumeric:"tabular-nums",
                    color: step.active ? tc : step.done ? C.textMid : C.textLow
                  }}>{step.time}</span>
                </div>
              ))}
              
              {/* Total */}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:16, paddingTop:16, borderTop:"1px solid rgba(255,255,255,0.1)" }}>
                <span style={{ fontSize:9, letterSpacing:"0.15em", color:C.textMid, textTransform:"uppercase" }}>Total cycle time</span>
                <span style={{ fontSize:18, fontWeight:400, color:tc, fontVariantNumeric:"tabular-nums", fontFamily:mono }}>{formatted}</span>
              </div>
            </div>

            {/* Action buttons: Checkpoint, Message, Alert */}
            <div style={{ display:"flex", gap:10 }}>
              <button 
                onClick={(e) => { e.stopPropagation(); setCycleStatus("exchanged"); }} 
                style={{ 
                  flex:1,
                  display:"flex",
                  alignItems:"center",
                  justifyContent:"center",
                  gap:8,
                  backgroundColor:"rgba(255,255,255,0.08)", 
                  border:"1px solid rgba(255,255,255,0.2)", 
                  borderRadius:8, 
                  padding:14, 
                  fontSize:10, 
                  letterSpacing:"0.12em", 
                  textTransform:"uppercase", 
                  color:C.textHigh, 
                  cursor:"pointer", 
                  fontFamily:mono
                }}
              >
                <ThumbsUp size={14} />
                {leg === 1 ? "Collected" : "Delivered"}
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); openWhatsApp(); }} 
                style={{ 
                  display:"flex",
                  alignItems:"center",
                  justifyContent:"center",
                  backgroundColor:"rgba(255,255,255,0.04)", 
                  border:"1px solid rgba(255,255,255,0.1)", 
                  borderRadius:8, 
                  width:48,
                  cursor:"pointer"
                }}
              >
                <MessageCircle size={16} color="rgba(255,255,255,0.6)" />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); onIncident && onIncident(); }} 
                style={{ 
                  display:"flex",
                  alignItems:"center",
                  justifyContent:"center",
                  backgroundColor:"rgba(255,255,255,0.04)", 
                  border:"1px solid rgba(255,255,255,0.1)", 
                  borderRadius:8, 
                  width:48,
                  cursor:"pointer"
                }}
              >
                <AlertTriangle size={16} color="rgba(255,255,255,0.6)" />
              </button>
            </div>
          </>}

          {/* COMPLETE */}
          {cycle.status==="complete"&&<>
            {/* Header: Contact name, company with rating */}
            <div style={{ marginBottom:28 }}>
              <div style={{ fontSize:24, fontWeight:400, color:C.textHigh, fontFamily:serif }}>{cycle.buyer.contact || "Ygor"}</div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:6 }}>
                <span style={{ fontSize:11, color:C.textMid }}>{cycle.buyer.name}</span>
                <Stars score={cycle.buyer.score} muted />
              </div>
            </div>

            {/* Timeline - all complete */}
            <div style={{ marginBottom:32 }}>
              {[
                { label: "Instruction issued", time: "00:00" },
                { label: "EFT sent — R450,000", time: "00:43" },
                { label: "USD collected — $25,000", time: "01:30" },
                { label: "Handover complete", time: "02:02" },
                { label: "WhatsApp sent", time: "02:02" },
                { label: "ZAR settled — R465,750", time: "02:20" },
              ].map((step, i) => (
                <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                    <div style={{ 
                      width:8, height:8, borderRadius:"50%", 
                      backgroundColor: C.green
                    }} />
                    <span style={{ fontSize:13, color: C.textHigh }}>{step.label}</span>
                  </div>
                  <span style={{ fontSize:13, fontVariantNumeric:"tabular-nums", color: C.textMid }}>{step.time}</span>
                </div>
              ))}
              
              {/* Total */}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:16, paddingTop:16, borderTop:"1px solid rgba(255,255,255,0.1)" }}>
                <span style={{ fontSize:9, letterSpacing:"0.15em", color:C.textMid, textTransform:"uppercase" }}>Total cycle time</span>
                <span style={{ fontSize:18, fontWeight:400, color:C.green, fontVariantNumeric:"tabular-nums", fontFamily:mono }}>18:00.00</span>
              </div>
              
              {/* Margin and Profit tiles - matching home page style */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginTop:16 }}>
                <div style={{ backgroundColor:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:14 }}>
                  <div style={{ fontSize:9, letterSpacing:"0.35em", color:"rgba(255,255,255,0.5)", textTransform:"uppercase" }}>Margin</div>
                  <div style={{ fontSize:22, fontWeight:400, color:C.textHigh, marginTop:6, fontFamily:serif }}>3.40%</div>
                </div>
                <div style={{ backgroundColor:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:14 }}>
                  <div style={{ fontSize:9, letterSpacing:"0.35em", color:"rgba(255,255,255,0.5)", textTransform:"uppercase" }}>Profit</div>
                  <div style={{ fontSize:22, fontWeight:400, color:C.green, marginTop:6, fontFamily:serif }}>R15,300</div>
                </div>
              </div>
            </div>
          </>}

          {/* SCHEDULED */}
          {cycle.status==="scheduled"&&<>
            <div style={{ fontSize:10, letterSpacing:"0.15em", color:C.textMid, textTransform:"uppercase", marginBottom:14 }}>Pre-cycle checklist</div>
            {checkItems.map((item,i)=>(
              <div key={i} onClick={()=>setChecks(c=>{const n=[...c];n[i]=!n[i];return n;})}
                style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 0", borderBottom:`1px solid rgba(255,255,255,0.08)`, cursor:"pointer", opacity:checks[i]?1:0.6 }}>
                <div style={{ width:16, height:16, borderRadius:"50%", border:`1.5px solid ${checks[i]?C.green:C.border}`, backgroundColor:checks[i]?C.green:"transparent", display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, color:"#fff", flexShrink:0 }}>{checks[i]?"✓":""}</div>
                <span style={{ fontSize:11, color:checks[i]?C.text:C.textMid }}>{item}</span>
              </div>
            ))}
            <div style={{ display:"flex", justifyContent:"space-between", margin:"16px 0" }}>
              <div>
                <div style={{ fontSize:9, color:C.textMid, letterSpacing:"0.12em" }}>GO/NO-GO</div>
                <div style={{ fontSize:20, fontWeight:600, color:allDone?C.green:C.amber, marginTop:3 }}>{allDone?"GO":"PENDING"}</div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:9, color:C.textMid, letterSpacing:"0.12em" }}>MIN RATE</div>
                <div style={{ fontSize:20, fontWeight:600, marginTop:3 }}>R18.34<span style={{ fontSize:11, color:C.textMid }}>/USD</span></div>
              </div>
            </div>
            <button style={{ width:"100%", backgroundColor:allDone?C.green:"rgba(255,255,255,0.08)", border:`1px solid ${allDone?C.green:"rgba(255,255,255,0.15)"}`, borderRadius:8, padding:14, fontSize:10, letterSpacing:"0.18em", textTransform:"uppercase", color:allDone?"#fff":C.textLow, cursor:allDone?"pointer":"not-allowed", fontFamily:mono }}>
              {allDone?"ACTIVATE CYCLE":`COMPLETE CHECKLIST (${10-checks.filter(Boolean).length} remaining)`}
            </button>
          </>}
        </div>
      </div>
    </>
  )
}

// ─── DIRECTOR VIEW ────────────────────────────────────────────────────────────
function DirectorView({ user, onLogout }: { user: User; onLogout: () => void }) {
  const myCycles = CYCLES.filter(c => ("companies" in user && user.companies?.includes(c.company)) || c.director === user.name)
  const myCompanies = COMPANIES.filter(c => "companies" in user && user.companies?.some((uc: string) => c.name.includes(uc) || uc.includes(c.short) || c.name === uc))
  return (
    <div style={{ backgroundColor:C.bg, minHeight:"100vh", fontFamily:mono, paddingBottom:20, color:C.text }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"28px 28px 24px", borderBottom:`1px solid ${C.border}` }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <TreePalm size={18} style={{ color:"rgba(255,255,255,0.88)" }} />
          <span style={{ fontSize:13, letterSpacing:"0.22em", color:"rgba(255,255,255,0.88)", fontFamily:mono, textTransform:"uppercase", fontWeight:500 }}>YXK</span>
        </div>
        <div style={{ display:"flex", gap:10, alignItems:"center" }}>
          <Tag color={ROLE_COLORS.partner}>Partner</Tag>
          <button onClick={onLogout} style={{ background:"none", border:"none", color:C.textLow, cursor:"pointer", fontSize:16 }}>↩</button>
        </div>
      </div>
      <div style={{ padding:"20px 20px 0" }}>
        <SectionLabel>Your companies</SectionLabel>
        {myCompanies.map((co,i)=>{
          const pct=(co.cumulative/20000000)*100
          const col=pct<70?C.green:pct<90?C.amber:C.red
          return <div key={i} style={{ marginBottom:18, padding:"0 20px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
              <span style={{ fontSize:12, color:C.text }}>{co.name}</span>
              <span style={{ fontSize:11, color:col }}>R{(co.cumulative/1e6).toFixed(2)}M</span>
            </div>
            <Bar pct={pct} color={col}/>
            <div style={{ display:"flex", justifyContent:"space-between", marginTop:3 }}>
              <span style={{ fontSize:9, color:C.textLow }}>of R20M facility</span>
              <span style={{ fontSize:9, color:C.textLow }}>{pct.toFixed(0)}%</span>
            </div>
          </div>
        })}
      </div>
      <Divider/>
      <SectionLabel>Your cycles this week</SectionLabel>
      {myCycles.map((c,i)=><CycleRow key={i} cycle={c} showLocation/>)}
      <div style={{ margin:"24px 20px 0", padding:"14px 16px", backgroundColor:C.surface, border:`1px solid ${C.border}`, borderRadius:8 }}>
        <div style={{ fontSize:10, color:C.textMid, letterSpacing:"0.1em" }}>Notice obligations</div>
        <div style={{ fontSize:12, color:C.text, marginTop:8 }}>Next: <span style={{ color:C.amber }}>THU 09:30 — 48h advance required</span></div>
      </div>
    </div>
  )
}

// ─── AGENT VIEW ───────────────────────────────────---───────────────────────────
function AgentView({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [step, setStep] = useState(0)
  const [checked, setChecked] = useState({ a:false, b:false })
  const cycle = CYCLES.find(c=>"agent" in user && c.agent===user.agent) || CYCLES[0]
  return (
    <div style={{ backgroundColor:C.bg, minHeight:"100vh", fontFamily:mono, color:C.text }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"28px 28px 24px", borderBottom:`1px solid ${C.border}` }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <TreePalm size={18} style={{ color:"rgba(255,255,255,0.88)" }} />
          <span style={{ fontSize:13, letterSpacing:"0.22em", color:"rgba(255,255,255,0.88)", fontFamily:mono, textTransform:"uppercase", fontWeight:500 }}>YXK</span>
        </div>
        <div style={{ display:"flex", gap:10, alignItems:"center" }}>
          <Tag color={ROLE_COLORS.agent}>Agent</Tag>
          <button onClick={onLogout} style={{ background:"none", border:"none", color:C.textLow, cursor:"pointer", fontSize:16 }}>↩</button>
        </div>
      </div>
      <div style={{ padding:20 }}>
        <div style={{ backgroundColor:C.surface, border:`1px solid ${C.amber}28`, borderRadius:8, padding:16 }}>
          <Tag color={C.amber}>{cycle.slot}</Tag>
          <div style={{ fontSize:18, fontWeight:600, color:C.text, marginTop:10 }}>Collection</div>
          <div style={{ fontSize:12, color:C.textMid, marginTop:4 }}>Inter Africa — Benoni</div>
          <div style={{ marginTop:14, paddingTop:14, borderTop:`1px solid ${C.border}` }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
              <span style={{ fontSize:10, color:C.textMid, letterSpacing:"0.1em" }}>EXPECTED</span>
              <span style={{ fontSize:14, fontWeight:600 }}>$25,000</span>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
              <span style={{ fontSize:10, color:C.textMid, letterSpacing:"0.1em" }}>BUYER</span>
              <span style={{ fontSize:12 }}>{cycle.buyer.name}</span>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between" }}>
              <span style={{ fontSize:10, color:C.textMid, letterSpacing:"0.1em" }}>DELIVER TO</span>
              <span style={{ fontSize:12 }}>{cycle.director}</span>
            </div>
          </div>
        </div>
        <div style={{ marginTop:20 }}>
          {step===0&&<button onClick={()=>setStep(1)} style={{ width:"100%", backgroundColor:C.blue, border:"none", borderRadius:8, padding:16, fontSize:11, letterSpacing:"0.18em", textTransform:"uppercase", color:"#fff", cursor:"pointer", fontFamily:mono }}>→ I AM ON MY WAY</button>}
          {step===1&&<>
            <div style={{ backgroundColor:`${C.blue}14`, border:`1px solid ${C.blue}28`, borderRadius:8, padding:"12px 14px", marginBottom:12, fontSize:11, color:C.blue }}>En route to Inter Africa</div>
            <button onClick={()=>setStep(2)} style={{ width:"100%", backgroundColor:C.green, border:"none", borderRadius:8, padding:16, fontSize:11, letterSpacing:"0.18em", textTransform:"uppercase", color:"#fff", cursor:"pointer", fontFamily:mono }}>→ I HAVE COLLECTED</button>
          </>}
          {step===2&&<>
            <div style={{ backgroundColor:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:14, marginBottom:12 }}>
              <div style={{ fontSize:10, color:C.textMid, letterSpacing:"0.15em", marginBottom:10 }}>CONFIRM BEFORE HANDOVER</div>
              {[{key:"a",label:"Amount counted and verified"},{key:"b",label:"Recipient identity verified"}].map(item=>(
                <div key={item.key} onClick={()=>setChecked(c=>({...c,[item.key]:!c[item.key as keyof typeof c]}))} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 0", borderBottom:`1px solid ${C.border}`, cursor:"pointer" }}>
                  <div style={{ width:18, height:18, borderRadius:"50%", border:`1.5px solid ${checked[item.key as keyof typeof checked]?C.green:C.border}`, backgroundColor:checked[item.key as keyof typeof checked]?C.green:"transparent", display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, color:"#fff", flexShrink:0 }}>{checked[item.key as keyof typeof checked]?"✓":""}</div>
                  <span style={{ fontSize:12, color:checked[item.key as keyof typeof checked]?C.text:C.textMid }}>{item.label}</span>
                </div>
              ))}
            </div>
            <input placeholder="Amount handed over (ZAR)" style={{ width:"100%", backgroundColor:C.surface, border:`1px solid ${C.border}`, borderRadius:6, padding:12, color:C.text, fontSize:12, fontFamily:mono, boxSizing:"border-box", marginBottom:8 }}/>
            <input placeholder="Handover location" style={{ width:"100%", backgroundColor:C.surface, border:`1px solid ${C.border}`, borderRadius:6, padding:12, color:C.text, fontSize:12, fontFamily:mono, boxSizing:"border-box", marginBottom:12 }}/>
            <button onClick={()=>{if(checked.a&&checked.b)setStep(3);}} style={{ width:"100%", backgroundColor:(checked.a&&checked.b)?C.green:C.surfaceHigh, border:"none", borderRadius:8, padding:16, fontSize:11, letterSpacing:"0.18em", textTransform:"uppercase", color:(checked.a&&checked.b)?"#fff":C.textLow, cursor:(checked.a&&checked.b)?"pointer":"not-allowed", fontFamily:mono }}>→ RECORD HANDOVER</button>
          </>}
          {step===3&&<div style={{ textAlign:"center", padding:"32px 0" }}>
            <div style={{ fontSize:52 }}>✓</div>
            <div style={{ fontSize:18, fontWeight:600, color:C.green, marginTop:12 }}>Handover complete</div>
            <div style={{ fontSize:12, color:C.textMid, marginTop:8 }}>Your role for this cycle is complete</div>
          </div>}
        </div>
      </div>
    </div>
  )
}

// ─── OPERATOR APP ─────────────────────────────────────────────────────────────
function OperatorApp({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [screen, setScreen] = useState("home")
  const [sel, setSel] = useState<Cycle | null>(null)
  const [selBuyer, setSelBuyer] = useState<Buyer | null>(null)
  const [currentLeg, setCurrentLeg] = useState<1 | 2>(2) // 1 = to seller, 2 = to buyer
  
  // Active drops for scaled operations (multiple simultaneous cycles)
  // leg: 1 = to USD seller (carrying ZAR), 2 = to USD buyer (carrying USD)
  const activeDrops = [
    { id: 1, city: "JHB", leg: 2 as 1|2, operatorLat: -26.1520, operatorLng: 28.0870, destLat: -26.1095, destLng: 28.2294, destName: "N.D. Gold & Money Ex.", carrying: "$26k", profit: "R340", dotColor: "green" as "green"|"blue"|"amber" },
    { id: 2, city: "JHB", leg: 1 as 1|2, operatorLat: -26.2041, operatorLng: 28.0473, destLat: -26.1629, destLng: 28.3234, destName: "Inter Africa · Benoni", carrying: "R450k", profit: "R15,750", dotColor: "blue" as "green"|"blue"|"amber" },
    { id: 3, city: "PTA", leg: 2 as 1|2, operatorLat: -25.7461, operatorLng: 28.1881, destLat: -25.7860, destLng: 28.2839, destName: "GP Collections · Menlyn", carrying: "$18k", profit: "R520", dotColor: "amber" as "green"|"blue"|"amber" },
  ]
  const [currentDropIndex, setCurrentDropIndex] = useState(0)
  const [pillExpanded, setPillExpanded] = useState(true)
  
  // Auto-collapse pill after 3 seconds
  useEffect(() => {
    if (pillExpanded && screen === "home") {
      const timer = setTimeout(() => setPillExpanded(false), 10000)
      return () => clearTimeout(timer)
    }
  }, [pillExpanded, screen])
  const [incident, setIncident] = useState(false)
  const [dismissedActions, setDismissedActions] = useState<string[]>([])
  const [expandedDays, setExpandedDays] = useState<string[]>([]) // controls collapsible Tomorrow/Wednesday sections
  const [v, setV] = useState(false)
  useEffect(() => { setTimeout(() => setV(true), 80) }, [])
  const fade = (d: number): React.CSSProperties => ({ opacity:v?1:0, transform:v?"none":"translateY(14px)", transition:`all 1.2s cubic-bezier(0.16,1,0.3,1) ${d}s` })
  const { mins, secs, formatted } = useTimer()
  const tc = mins<20?C.green:mins<30?C.amber:C.red

  const goToPage = (id: string) => { setScreen(id); setSel(null); setSelBuyer(null); }

  const nav = [{id:"home",icon:House},{id:"schedule",icon:Calendar},{id:"buyers",icon:HandCoins},{id:"stats",icon:ChartNoAxesColumn}]

  // Home screen computed values
  const activeCycle = CYCLES.find(c => c.status === "active")
  const activeBuyer = activeCycle ? getBuyer(activeCycle.buyerId) : BUYERS[0]
  const operatorLat = -26.107567
  const operatorLng = 28.056702

  // Schedule screen computed values
  const scheduleActions = [
    { id: "a1", director: "Luizette De Santo", action: "48h notice to Inter Africa required", company: "Luima Property", slot: "MON 13:30" },
    { id: "a2", director: "Delsie Somaes", action: "48h notice to Inter Africa required", company: "Imani Beauty", slot: "TUE 09:30" },
  ].filter(a => !dismissedActions.includes(a.id))

  // Show all cycles regardless of status (Today + Tomorrow view)
  const todayCycles = CYCLES.filter(c => c.slot.startsWith("MON"))
  const tomorrowCycles = CYCLES.filter(c => c.slot.startsWith("TUE"))

  

  // Buyer detail overlay is now rendered within the buyers screen section

  return (
    <div style={{ position:"relative", minHeight:"100vh", maxWidth:420, margin:"0 auto", fontFamily:mono, color:C.text }}>
      {/* Persistent Map backdrop - shared canvas for home, schedule, buyers, stats, and cycle detail */}
      {(screen === "home" || screen === "schedule" || screen === "buyers" || screen === "stats" || screen === "cycle") && (
        <div style={{ position:"fixed", inset:0, zIndex:0 }}>
<MapBackground
  key={screen === "home" ? `home-map-${currentDropIndex}` : "other-map"}
  operatorLat={screen === "home" ? activeDrops[currentDropIndex].operatorLat : operatorLat}
  operatorLng={screen === "home" ? activeDrops[currentDropIndex].operatorLng : operatorLng}
  destLat={screen === "home" ? activeDrops[currentDropIndex].destLat : activeBuyer.lat}
  destLng={screen === "home" ? activeDrops[currentDropIndex].destLng : activeBuyer.lng}
  destName={screen === "home" ? activeDrops[currentDropIndex].destName : activeBuyer.name}
  dotColor={screen === "home" ? activeDrops[currentDropIndex].dotColor : "green"}
  />
          {/* Darker overlay on non-home pages since map is non-interactive backdrop */}
          <div style={{ position:"absolute", inset:0, background: screen !== "home"
            ? "linear-gradient(to bottom, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.85) 50%, rgba(0,0,0,0.98) 100%)" 
            : "linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.6) 50%, rgba(0,0,0,0.92) 100%)" 
          }} />
        </div>
      )}
      
      {/* Fallback backdrop for other screens */}
      {screen !== "home" && screen !== "schedule" && screen !== "buyers" && screen !== "stats" && screen !== "cycle" && (
        <div style={{ position:"fixed", inset:0, zIndex:0 }}>
          <img src={HERO_IMG} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
          <div style={{ position:"absolute", inset:0, backgroundColor:"rgba(0,0,0,0.97)" }} />
        </div>
      )}
      {incident && <IncidentMode onClose={()=>setIncident(false)}/>}

      <div style={{ position:"relative", zIndex:1, paddingBottom:68 }}>

        {/* ── HOME ── */}
        {screen==="home" && <>
          {/* Header */}
          <div style={{ ...fade(0), padding:"28px 28px 24px", position:"relative", zIndex:2, display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
            <div onClick={onLogout} style={{ cursor:"pointer", display:"inline-block" }}>
              <TreePalm size={18} style={{ color:"rgba(255,255,255,0.88)", transition:"opacity 0.2s" }} />
            </div>
          </div>
          
          {/* Floating drop pill - below header, right aligned */}
          <div 
            onClick={() => {
              if (pillExpanded) {
                // Cycle to next drop
                setCurrentDropIndex((currentDropIndex + 1) % activeDrops.length)
                setPillExpanded(true) // Reset timer
              } else {
                setPillExpanded(true)
              }
            }}
            style={{ 
              position:"absolute", 
              top:72, 
              right:20, 
              zIndex:10,
              background:"rgba(255,255,255,0.08)", 
              backdropFilter:"blur(8px)", 
              borderRadius:3, 
              border:"1px solid rgba(255,255,255,0.22)",
              padding: pillExpanded ? "8px 14px" : "8px 10px",
              display:"flex", 
              alignItems:"center", 
              gap:6,
              cursor:"pointer",
              transition:"all 0.25s",
              fontFamily:mono
            }}
          >
            {pillExpanded && (
              <span style={{ fontSize:10, color:"rgba(255,255,255,0.75)", letterSpacing:"0.18em", textTransform:"uppercase" }}>
                {activeDrops[currentDropIndex].city} · Cycle {activeDrops[currentDropIndex].id}
              </span>
            )}
            <TowerControl size={12} style={{ color:"rgba(255,255,255,0.75)" }} />
          </div>
          
          {/* Content tile - home dashboard - entire tile is tappable */}
          <div 
            onClick={() => setSel(CYCLES.find(c=>c.status==="active") || CYCLES[0])}
            style={{ ...fade(0.15), position:"relative", zIndex:2, margin:"45vh 20px 20px", padding:"24px", backgroundColor:"rgba(0,0,0,0.75)", backdropFilter:"blur(20px)", borderRadius:12, border:"1px solid rgba(255,255,255,0.1)", cursor:"pointer" }}
          >
            <div style={{ fontSize:9, letterSpacing:"0.35em", color:"rgba(255,255,255,0.5)", textTransform:"uppercase", marginBottom:8 }}>{activeDrops[currentDropIndex].leg === 1 ? "En route to USD seller" : "In transit to USD buyer"}</div>
            <div style={{ display:"flex", alignItems:"baseline", gap:4 }}>
              <div style={{ fontSize:64, fontWeight:400, color:tc, letterSpacing:"-0.02em", lineHeight:1, fontFamily:mono }}>
                {formatted}
              </div>
            </div>
            
            {/* Cards row */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginTop:24 }}>
              <div style={{ backgroundColor:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:14 }}>
                <div style={{ fontSize:9, letterSpacing:"0.35em", color:"rgba(255,255,255,0.5)", textTransform:"uppercase" }}>Carrying</div>
                <div style={{ fontSize:22, fontWeight:400, color:C.amber, marginTop:6, fontFamily:serif }}>{activeDrops[currentDropIndex].carrying}</div>
              </div>
              <div style={{ backgroundColor:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:14 }}>
                <div style={{ fontSize:9, letterSpacing:"0.35em", color:"rgba(255,255,255,0.5)", textTransform:"uppercase" }}>Est. profit</div>
                <div style={{ fontSize:22, fontWeight:400, color:C.green, marginTop:6, fontFamily:serif }}>{activeDrops[currentDropIndex].profit}</div>
              </div>
            </div>
          </div>
          
          {/* CycleDetail bottom sheet overlay - stays on home page */}
          {sel && (
            <CycleDetail 
              cycle={sel} 
              onBack={() => setSel(null)} 
              onBuyerTap={(b) => { setSelBuyer(b); setScreen("buyer"); }}
              onIncident={() => {}}
              timerData={{ mins, secs, formatted }}
              leg={activeDrops[currentDropIndex]?.leg || 1}
            />
          )}
          </>}

        {/* ── SCHEDULE SCREEN ── */}
        {screen==="schedule" && <>
          {/* Header - TreePalm only (matches home position) */}
          <div style={{ ...fade(0), padding:"28px 28px 24px", position:"relative", zIndex:2 }}>
            <div onClick={onLogout} style={{ cursor:"pointer", display:"inline-block" }}>
              <TreePalm size={18} style={{ color:"rgba(255,255,255,0.88)", transition:"opacity 0.2s" }} />
            </div>
          </div>
          
          {/* Content positioned over map */}
          <div style={{ position:"relative", zIndex:2, marginTop:"12vh" }}>
            
            {/* Unified tile - landing page inspired */}
            <div style={{ ...fade(0.1), margin:"0 20px 20px", padding:"24px", backgroundColor:"rgba(0,0,0,0.6)", backdropFilter:"blur(20px)", borderRadius:12, border:"1px solid rgba(255,255,255,0.1)" }}>
              
              {/* Actions section */}
              <div style={{ fontSize:26, fontWeight:400, color:C.text, fontFamily:serif, marginBottom:20 }}>Actions</div>
              
              {scheduleActions.length === 0 ? (
                <div style={{ fontSize:12, color:C.textLow }}>No actions required</div>
              ) : (
                scheduleActions.map((a, i) => (
                  <div key={a.id} style={{ display:"flex", alignItems:"flex-start", gap:12, marginTop: i > 0 ? 18 : 0 }}>
                    <button 
                      onClick={() => setDismissedActions(prev => [...prev, a.id])}
                      style={{ width:18, height:18, borderRadius:4, border:`1px solid rgba(255,255,255,0.2)`, background:"transparent", cursor:"pointer", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", color:C.textMid, fontSize:9, marginTop:2 }}
                    >
                      ✓
                    </button>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:500, color:C.textHigh }}>{a.director}</div>
                      <div style={{ fontSize:11, color:C.textMid, marginTop:3 }}>{a.action}</div>
                      <div style={{ fontSize:10, color:C.textLow, marginTop:3 }}>{a.company} · {a.slot}</div>
                    </div>
                  </div>
                ))
              )}
              
              {/* Short accent line separator - landing page style */}
              <div style={{ width:48, height:1, backgroundColor:"rgba(255,255,255,0.15)", margin:"32px 0" }} />
              
              {/* Today section */}
              <div style={{ fontSize:26, fontWeight:400, color:C.text, fontFamily:serif, marginBottom:20 }}>Today</div>
              
              {todayCycles.length === 0 ? (
                <div style={{ fontSize:12, color:C.textLow }}>No cycles scheduled</div>
              ) : (
                todayCycles.map((c, i) => {
                  const time = c.slot.split(" ")[1]
                  return (
                    <div key={i} onClick={()=>{ setSel(c); setScreen("cycle"); }}
                      style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 0", cursor:"pointer" }}
                    >
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <span style={{ fontSize:11, color:C.textMid, fontFamily:mono }}>{time}</span>
                          <span style={{ fontSize:13, fontWeight:500, color:C.textHigh }}>{c.company}</span>
                        </div>
                        <div style={{ fontSize:11, color:C.textMid, marginTop:3 }}>{c.buyer.name}</div>
                      </div>
                      <div style={{ flexShrink:0 }}><Stars score={c.buyer.score}/></div>
                    </div>
                  )
                })
              )}
              
              {/* Tomorrow - collapsible */}
              {tomorrowCycles.length > 0 && (
                <div style={{ marginTop:16, paddingTop:16 }}>
                  <div 
                    onClick={() => setExpandedDays(prev => prev.includes("TUE") ? prev.filter(d => d !== "TUE") : [...prev, "TUE"])}
                    style={{ display:"flex", alignItems:"center", justifyContent:"space-between", cursor:"pointer", padding:"4px 0" }}
                  >
                    <span style={{ fontSize:15, color:C.textMid }}>Tomorrow</span>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ fontSize:11, color:C.textLow }}>{tomorrowCycles.length} cycle{tomorrowCycles.length !== 1 ? "s" : ""}</span>
                      <span style={{ fontSize:14, color:C.textMid, transform: expandedDays.includes("TUE") ? "rotate(90deg)" : "none", transition:"transform 0.2s" }}>›</span>
                    </div>
                  </div>
                  {expandedDays.includes("TUE") && tomorrowCycles.map((c, i) => {
                    const time = c.slot.split(" ")[1]
                    return (
                      <div key={i} onClick={()=>{ setSel(c); setScreen("cycle"); }}
                        style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 0", cursor:"pointer" }}
                      >
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                            <span style={{ fontSize:11, color:C.textMid, fontFamily:mono }}>{time}</span>
                            <span style={{ fontSize:13, fontWeight:500, color:C.textHigh }}>{c.company}</span>
                          </div>
                          <div style={{ fontSize:11, color:C.textMid, marginTop:3 }}>{c.buyer.name}</div>
                        </div>
                        <div style={{ flexShrink:0 }}><Stars score={c.buyer.score}/></div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </>}

        {/* ── CYCLE DETAIL ── */}
        {screen==="cycle" && sel && (
<CycleDetail 
            cycle={sel} 
            onBack={()=>setScreen("schedule")} 
            onBuyerTap={b=>setSelBuyer(b)}
            onIncident={()=>setIncident(true)}
            timerData={{ mins, secs, formatted }}
            leg={activeDrops[currentDropIndex]?.leg || 1}
          />
        )}

        {/* ── BUYERS ── */}
        {screen==="buyers" && <>
          {/* Header - TreePalm only */}
          <div style={{ padding:"28px 28px 24px" }}>
            <TreePalm size={18} style={{ color:"rgba(255,255,255,0.88)" }} />
          </div>

          {/* Content tile */}
          <div style={{ margin:"0 20px 20px", padding:"24px", backgroundColor:"rgba(0,0,0,0.6)", backdropFilter:"blur(20px)", borderRadius:12, border:"1px solid rgba(255,255,255,0.1)" }}>
            
            {/* Section: Buyers */}
            <div style={{ fontSize:26, fontWeight:400, color:C.text, fontFamily:serif, marginBottom:20 }}>Buyers</div>
            
            {/* Concentration bar */}
            <div style={{ display:"flex", gap:2, height:10, borderRadius:5, overflow:"hidden", marginBottom:12, backgroundColor:"rgba(255,255,255,0.05)" }}>
              {BUYERS.map((b,i)=><div key={i} style={{ flex:b.weeklyShare, backgroundColor:BUYER_COLORS[i], minWidth:4 }}/>)}
            </div>
            {/* Concentration labels */}
            <div style={{ display:"flex", flexWrap:"wrap", gap:"4px 12px", marginBottom:20 }}>
              {BUYERS.map((b,i)=>(
                <div key={i} style={{ display:"flex", alignItems:"center", gap:5 }}>
                  <div style={{ width:6, height:6, borderRadius:"50%", backgroundColor:BUYER_COLORS[i] }}/>
                  <span style={{ fontSize:10, color:C.textMid }}>{b.name.split(" ")[0]} {b.weeklyShare}%</span>
                </div>
              ))}
            </div>
            
            {/* Short accent line separator */}
            <div style={{ width:48, height:1, backgroundColor:"rgba(255,255,255,0.15)", margin:"20px 0" }} />
            
            {/* Buyer list - clean, no % since bar shows it */}
            {BUYERS.map((b,i)=>(
              <div key={i} onClick={()=>setSelBuyer(b)}
                style={{ padding:"12px 0", cursor:"pointer" }}
              >
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontSize:14, fontWeight:500, color:C.textHigh }}>{b.name}</span>
                  <Stars score={b.score}/>
                </div>
                <div style={{ fontSize:11, color:C.textMid, marginTop:4 }}>{b.location}</div>
              </div>
            ))}

            {/* Short accent line separator */}
            <div style={{ width:48, height:1, backgroundColor:"rgba(255,255,255,0.15)", margin:"24px 0" }} />

            {/* Section: Markets (active only) */}
            <div style={{ fontSize:26, fontWeight:400, color:C.text, fontFamily:serif, marginBottom:16 }}>Markets</div>
            <span style={{ fontSize:12, color:C.textHigh }}>Johannesburg · Pretoria</span>
          </div>
          
          {/* Buyer detail overlay */}
          {selBuyer && <BuyerDetail buyer={selBuyer} onBack={()=>setSelBuyer(null)}/>}
        </>}

        {/* ── STATS ── */}
        {screen==="stats" && <>
          {/* Header - TreePalm only */}
          <div style={{ padding:"28px 28px 24px" }}>
            <TreePalm size={18} style={{ color:"rgba(255,255,255,0.88)" }} />
          </div>

          {/* Content tile */}
          <div style={{ margin:"0 20px 20px", padding:"24px", backgroundColor:"rgba(0,0,0,0.6)", backdropFilter:"blur(20px)", borderRadius:12, border:"1px solid rgba(255,255,255,0.1)" }}>
            
            {/* HQ Reserve - Primary foundational metric */}
            <div style={{ 
              marginBottom:28, 
              paddingBottom:24, 
              borderBottom:"1px solid rgba(255,255,255,0.08)"
            }}>
              <div style={{ fontSize:9, letterSpacing:"0.35em", color:"rgba(255,255,255,0.5)", textTransform:"uppercase", marginBottom:10 }}>HQ Reserve</div>
              <div style={{ fontSize:42, fontWeight:400, color:C.amber, fontFamily:serif, letterSpacing:"-0.02em" }}>$4,217</div>
              <div style={{ fontSize:10, color:C.textMid, marginTop:8 }}>Physical USD retained at JHB hub</div>
            </div>
            
            {/* Section: Performance */}
            <div style={{ fontSize:26, fontWeight:400, color:C.text, fontFamily:serif, marginBottom:20 }}>Performance</div>
            
            {/* KPI grid - muted styling */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:8 }}>
              {[["Gross margin","R47,250"],["Cycles","9 / 9"],["Avg cycle","22 min"],["Avg margin","3.3%"]].map(([l,v])=>(
                <div key={l as string}>
                  <div style={{ fontSize:9, letterSpacing:"0.12em", color:C.textMid, textTransform:"uppercase", marginBottom:6 }}>{l}</div>
                  <div style={{ fontSize:20, fontWeight:600, color:C.textHigh }}>{v}</div>
                </div>
              ))}
            </div>

            {/* Short accent line separator */}
            <div style={{ width:48, height:1, backgroundColor:"rgba(255,255,255,0.15)", margin:"24px 0" }} />

            {/* Section: Cycle Times */}
            <div style={{ fontSize:26, fontWeight:400, color:C.text, fontFamily:serif, marginBottom:16 }}>Cycle Times</div>
            {[["Imani Beauty","TUE 09:30",16],["Maria's Garden","FRI 09:30",17],["Wolf Digital","MON 09:30",18],["Ashu & Co","WED 09:30",19],["Medcare","THU 09:30",21],["Luima Property","MON 13:30",22],["Goblin Research","WED 13:30",24],["Kenny Const.","THU 13:30",35],["Crown Hair","TUE 13:30",41]].map(([co,slot,t])=>{
              const col=(t as number)<20?C.textMid:(t as number)<30?C.amber:C.red
              return <div key={co as string} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 0" }}>
                <div style={{ fontSize:16, fontWeight:600, color:C.textHigh, width:32, textAlign:"right", flexShrink:0 }}>{t}<span style={{ fontSize:10, color:C.textMid, marginLeft:2 }}>m</span></div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, color:C.textHigh }}>{co}</div>
                  <div style={{ fontSize:10, color:C.textMid, marginTop:2 }}>{slot}</div>
                </div>
                <div style={{ width:50 }}><Bar pct={((t as number)/60)*100} color={col}/></div>
              </div>
            })}

            {/* Short accent line separator */}
            <div style={{ width:48, height:1, backgroundColor:"rgba(255,255,255,0.15)", margin:"24px 0" }} />

            {/* Section: Buyers */}
            <div style={{ fontSize:26, fontWeight:400, color:C.text, fontFamily:serif, marginBottom:16 }}>Buyers</div>
            {BUYERS.map((b,i)=>{
              const col=b.avgSettlement<20?C.textMid:b.avgSettlement<45?C.amber:C.red
              return <div key={i} onClick={()=>setSelBuyer(b)} style={{ padding:"10px 0", cursor:"pointer" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontSize:13, fontWeight:500, color:C.textHigh }}>{b.name}</span>
                  <span style={{ fontSize:11, color:C.textMid }}>{b.avgSettlement}m avg</span>
                </div>
                <div style={{ fontSize:10, color:C.textMid, marginTop:3 }}>{b.location}</div>
                <div style={{ marginTop:6 }}><Bar pct={(b.avgSettlement/120)*100} color={col}/></div>
              </div>
            })}

            {/* Short accent line separator */}
            <div style={{ width:48, height:1, backgroundColor:"rgba(255,255,255,0.15)", margin:"24px 0" }} />

            {/* Section: Exchange Limits */}
            <div style={{ fontSize:26, fontWeight:400, color:C.text, fontFamily:serif, marginBottom:16 }}>Exchange Limits</div>
            {COMPANIES.map((co,i)=>{
              const pct=(co.cumulative/20000000)*100
              const col=pct<70?C.textMid:pct<90?C.amber:C.red
              return <div key={i} style={{ padding:"10px 0" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                  <div>
                    <div style={{ fontSize:13, color:C.textHigh, fontWeight:500 }}>{co.short}</div>
                    <div style={{ fontSize:10, color:C.textMid, marginTop:2 }}>{co.director}</div>
                  </div>
                  <span style={{ fontSize:12, color:C.textHigh, fontFamily:mono }}>R{(co.cumulative/1e6).toFixed(1)}M</span>
                </div>
                <Bar pct={pct} color={col}/>
                <div style={{ fontSize:9, color:C.textMid, marginTop:4, textAlign:"right" }}>{pct.toFixed(0)}% of R20M limit</div>
              </div>
            })}
          </div>
        </>}

      </div>

      {/* Nav */}
      {screen!=="cycle" && (
        <div style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:420, backgroundColor:"rgba(0,0,0,0.95)", backdropFilter:"blur(12px)", display:"flex", justifyContent:"space-around", padding:"14px 0 18px", zIndex:100 }}>
          {nav.map(item=>(
            <div key={item.id} onClick={()=>goToPage(item.id)} style={{ cursor:"pointer", padding:"8px 16px" }}>
              <item.icon size={20} style={{ color:screen===item.id?"rgba(255,255,255,0.88)":"rgba(255,255,255,0.35)", transition:"color 0.2s" }} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


// ─── ROOT ───────---─────────--───────────────────────────────────-----──────────────
export default function App() {
  const [phase, setPhase] = useState("landing")
  const [selUser, setSelUser] = useState<User | null>(null)
  const [loggedIn, setLoggedIn] = useState<User | null>(null)

  if (phase==="landing") return <Landing onLogin={()=>setPhase("select")}/>
  if (phase==="select") return <UserSelect onSelect={(u: User)=>{setSelUser(u);setPhase("pin");}} onBack={()=>setPhase("landing")}/>
  if (phase==="pin"&&selUser) return <PinEntry user={selUser} onSuccess={(u: User)=>{setLoggedIn(u);setPhase("app");}} onBack={()=>setPhase("select")}/>
  if (phase==="app"&&loggedIn) {
    const logout = ()=>{ setLoggedIn(null); setSelUser(null); setPhase("landing"); }
    if (loggedIn.role==="principal") return <OperatorApp user={loggedIn} onLogout={logout}/>
    if (loggedIn.role==="partner") return <DirectorView user={loggedIn} onLogout={logout}/>
    if (loggedIn.role==="agent") return <AgentView user={loggedIn} onLogout={logout}/>
  }
  return null
}
