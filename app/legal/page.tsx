"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { TreePalm } from "lucide-react"

const C = {
  bg: "#0a0a0a", surface: "#111", surfaceHigh: "#1a1a1a",
  border: "#1f1f1f", borderHigh: "#2e2e2e",
  text: "#ebebeb", textHigh: "#c8c8c8", textMid: "#5a5a5a", textLow: "#4a4a4a",
  green: "#22c55e", amber: "#f59e0b", red: "#ef4444", blue: "#3b82f6",
}
const mono = "'SF Mono','Fira Code','Consolas',monospace"
const serif = "'Georgia','Times New Roman',serif"

export default function LegalPage() {
  const [v, setV] = useState(false)
  useEffect(() => { setTimeout(() => setV(true), 60) }, [])
  const fade: React.CSSProperties = { opacity:v?1:0, transform:v?"none":"translateY(14px)", transition:"all 1s cubic-bezier(0.16,1,0.3,1)" }

  const H = ({ children }: { children: React.ReactNode }) => (
    <h2 style={{ fontSize:22, fontWeight:400, color:"rgba(255,255,255,0.95)", fontFamily:serif, margin:"40px 0 8px", letterSpacing:"-0.01em" }}>{children}</h2>
  )
  const Sub = ({ children }: { children: React.ReactNode }) => (
    <h3 style={{ fontSize:11, fontWeight:500, color:"rgba(255,255,255,0.7)", fontFamily:mono, textTransform:"uppercase", letterSpacing:"0.12em", margin:"24px 0 8px" }}>{children}</h3>
  )
  const Num = ({ n, children }: { n: string; children: React.ReactNode }) => (
    <h3 style={{ fontSize:13, fontWeight:500, color:"rgba(255,255,255,0.85)", fontFamily:mono, margin:"24px 0 8px", letterSpacing:"0.04em" }}>{n}. {children}</h3>
  )
  const P = ({ children }: { children: React.ReactNode }) => (
    <p style={{ fontSize:13, lineHeight:1.7, color:"rgba(255,255,255,0.6)", margin:"0 0 12px", fontFamily:mono }}>{children}</p>
  )
  const Li = ({ children }: { children: React.ReactNode }) => (
    <li style={{ fontSize:13, lineHeight:1.7, color:"rgba(255,255,255,0.6)", marginBottom:6, fontFamily:mono }}>{children}</li>
  )
  const Ul = ({ children }: { children: React.ReactNode }) => (
    <ul style={{ margin:"0 0 12px", paddingLeft:18 }}>{children}</ul>
  )
  const Rule = () => (
    <div style={{ width:"100%", height:1, backgroundColor:"rgba(255,255,255,0.1)", margin:"48px 0" }}/>
  )

  return (
    <div style={{ position:"relative", minHeight:"100vh", backgroundColor:C.bg, color:C.text, fontFamily:mono }}>
      {/* Nav */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"28px 28px 24px", borderBottom:"1px solid rgba(255,255,255,0.08)", position:"sticky", top:0, backgroundColor:C.bg, zIndex:5 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <TreePalm size={18} style={{ color:"rgba(255,255,255,0.88)" }} />
          <span style={{ fontSize:13, letterSpacing:"0.22em", color:"rgba(255,255,255,0.88)", fontFamily:mono, textTransform:"uppercase", fontWeight:500 }}>YXK</span>
        </div>
        <Link href="/" style={{ background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.22)", borderRadius:3, padding:"8px 18px", color:"rgba(255,255,255,0.75)", fontSize:10, letterSpacing:"0.18em", textTransform:"uppercase", cursor:"pointer", fontFamily:mono, transition:"all 0.25s", textDecoration:"none" }}
          onMouseEnter={e=>{(e.currentTarget as HTMLAnchorElement).style.background="rgba(255,255,255,0.16)";(e.currentTarget as HTMLAnchorElement).style.color="#fff";}}
          onMouseLeave={e=>{(e.currentTarget as HTMLAnchorElement).style.background="rgba(255,255,255,0.08)";(e.currentTarget as HTMLAnchorElement).style.color="rgba(255,255,255,0.75)";}}
        >Back</Link>
      </div>

      {/* Content */}
      <div style={{ ...fade, maxWidth:680, margin:"0 auto", padding:"40px 28px 80px" }}>
        <div style={{ fontSize:11, color:"rgba(255,255,255,0.4)", letterSpacing:"0.12em", marginBottom:6 }}>BRICS AI (PTY) LTD</div>
        <h1 style={{ fontSize:32, fontWeight:400, color:"rgba(255,255,255,0.95)", fontFamily:serif, margin:"0 0 4px", letterSpacing:"-0.01em" }}>Terms and Conditions</h1>
        <div style={{ fontSize:11, color:"rgba(255,255,255,0.4)", letterSpacing:"0.08em" }}>Last Updated: June 2026</div>

        <P>These Terms and Conditions govern the use of this website and the provision of services by BRICS AI (PTY) LTD, Registration Number 2025/892761/07, a company incorporated in accordance with the laws of the Republic of South Africa (&ldquo;BRICS AI&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;).</P>
        <P>By accessing this website or engaging our services, you agree to these Terms and Conditions.</P>

        <Num n="1">Services</Num>
        <P>BRICS AI provides technology, software, consulting, and related business services as agreed with clients from time to time.</P>
        <P>The scope, deliverables, timelines, and pricing applicable to any engagement shall be governed by a separate written agreement, quotation, proposal, or statement of work.</P>

        <Num n="2">Payment</Num>
        <P>Payment terms will be specified in the applicable agreement, quotation, or invoice.</P>
        <P>Unless otherwise agreed in writing:</P>
        <Ul>
          <Li>Invoices are payable within thirty (30) days of issue.</Li>
          <Li>Late payments may incur interest at the maximum rate permitted by law.</Li>
          <Li>We reserve the right to suspend or terminate services where payments remain outstanding.</Li>
        </Ul>

        <Num n="3">Intellectual Property</Num>
        <P>Unless otherwise agreed in writing:</P>
        <Ul>
          <Li>All intellectual property created by BRICS AI remains the property of BRICS AI until all amounts due have been paid in full.</Li>
          <Li>Upon full payment, ownership and licensing rights shall transfer in accordance with the applicable service agreement.</Li>
        </Ul>
        <P>Pre-existing intellectual property, methodologies, software frameworks, and proprietary tools developed by BRICS AI remain the property of BRICS AI.</P>

        <Num n="4">Confidentiality</Num>
        <P>Both parties agree to keep confidential any proprietary, commercial, technical, or sensitive information disclosed during the course of an engagement and not to disclose such information to third parties except where required by law.</P>

        <Num n="5">Limitation of Liability</Num>
        <P>To the fullest extent permitted by law:</P>
        <Ul>
          <Li>BRICS AI shall not be liable for any indirect, consequential, incidental, special, or punitive damages.</Li>
          <Li>Our total liability arising from any claim relating to services provided shall not exceed the total fees paid by the client during the three (3) months immediately preceding the event giving rise to the claim.</Li>
        </Ul>

        <Num n="6">Website Use</Num>
        <P>Users agree not to:</P>
        <Ul>
          <Li>Use this website for unlawful purposes;</Li>
          <Li>Attempt to gain unauthorized access to systems or data;</Li>
          <Li>Distribute malicious software or harmful content;</Li>
          <Li>Interfere with the operation or security of the website.</Li>
        </Ul>
        <P>We reserve the right to restrict or terminate access where these conditions are breached.</P>

        <Num n="7">Governing Law</Num>
        <P>These Terms and Conditions shall be governed by and construed in accordance with the laws of the Republic of South Africa.</P>
        <P>Any dispute arising from these Terms shall be subject to the jurisdiction of the South African courts.</P>

        <Num n="8">Amendments</Num>
        <P>BRICS AI may amend these Terms and Conditions from time to time.</P>
        <P>Any revised version will be published on this website and will become effective upon publication.</P>
        <P>Continued use of the website or our services constitutes acceptance of the updated Terms.</P>

        <Rule/>

        <H>Refund Policy</H>
        <div style={{ fontSize:11, color:"rgba(255,255,255,0.4)", letterSpacing:"0.08em", marginBottom:8 }}>Last Updated: June 2026</div>

        <Sub>Project-Based Services</Sub>
        <P>Deposits paid for project-based work become non-refundable once work has commenced.</P>
        <P>If a project is cancelled before any work has begun, any deposit paid will be refunded within fourteen (14) business days.</P>

        <Sub>Milestone-Based Services</Sub>
        <P>Payments relating to completed milestones are non-refundable.</P>
        <P>Payments made for future milestones that have not yet commenced may be refunded in full at BRICS AI&rsquo;s discretion or as provided in the applicable agreement.</P>

        <Sub>Retainer and Maintenance Services</Sub>
        <P>Monthly retainer or maintenance fees are non-refundable for the current billing period.</P>
        <P>Clients may terminate ongoing retainer arrangements by providing thirty (30) days written notice.</P>
        <P>No further charges will accrue after the notice period expires.</P>

        <Sub>Service Disputes</Sub>
        <P>If you are dissatisfied with any aspect of our services, please contact us directly so that we may investigate and resolve the matter in good faith and as promptly as reasonably possible.</P>

        <Rule/>

        <H>Privacy Policy</H>
        <div style={{ fontSize:11, color:"rgba(255,255,255,0.4)", letterSpacing:"0.08em", marginBottom:8 }}>Last Updated: June 2026</div>
        <P>BRICS AI (PTY) LTD respects your privacy and is committed to protecting your personal information in accordance with the Protection of Personal Information Act, 2013 (&ldquo;POPIA&rdquo;).</P>

        <Sub>Information We Collect</Sub>
        <P>We may collect:</P>
        <Ul>
          <Li>Name and surname</Li>
          <Li>Email address</Li>
          <Li>Telephone number</Li>
          <Li>Company information</Li>
          <Li>Information submitted through contact forms</Li>
          <Li>Technical information relating to website usage</Li>
        </Ul>

        <Sub>How We Use Information</Sub>
        <P>We use personal information to:</P>
        <Ul>
          <Li>Respond to enquiries</Li>
          <Li>Deliver services</Li>
          <Li>Manage customer relationships</Li>
          <Li>Improve website functionality</Li>
          <Li>Comply with legal and regulatory obligations</Li>
        </Ul>

        <Sub>Information Sharing</Sub>
        <P>We do not sell personal information.</P>
        <P>We may share information with professional advisers, service providers, regulators, or authorities where required by law or where necessary to provide our services.</P>

        <Sub>Security</Sub>
        <P>We take reasonable technical and organisational measures to safeguard personal information against loss, misuse, unauthorised access, disclosure, alteration, or destruction.</P>

        <Sub>Your Rights</Sub>
        <P>Subject to applicable law, you may request:</P>
        <Ul>
          <Li>Access to personal information held about you;</Li>
          <Li>Correction of inaccurate information;</Li>
          <Li>Deletion of information where legally permissible;</Li>
          <Li>Withdrawal of consent where processing is based on consent.</Li>
        </Ul>
        <P>Requests may be directed to: ygor@brics.ninja</P>

        <Rule/>

        <H>Website Disclaimer</H>
        <P>The information contained on this website is provided for general informational purposes only.</P>
        <P>While BRICS AI seeks to ensure that information presented on this website is accurate and up to date, no representation or warranty is made regarding its completeness, reliability, or suitability for any particular purpose.</P>
        <P>Any reliance placed on information contained on this website is strictly at the user&rsquo;s own risk.</P>
        <P>Nothing contained on this website constitutes legal, financial, investment, tax, accounting, or professional advice.</P>
        <P>BRICS AI shall not be liable for any loss or damage arising directly or indirectly from the use of this website or reliance on information contained herein.</P>
        <P>Links to third-party websites are provided for convenience only. BRICS AI does not endorse and is not responsible for the content or practices of any third-party website.</P>

        <Rule/>

        <H>Contact</H>
        <P>BRICS AI (PTY) LTD</P>
        <P>Registration Number: 2025/892761/07</P>
        <Sub>Registered Office</Sub>
        <P>
          Mesh Club<br/>
          2nd Floor Trumpet on Keyes<br/>
          21 Keyes Avenue<br/>
          Rosebank<br/>
          Johannesburg<br/>
          Gauteng<br/>
          2196<br/>
          South Africa
        </P>
        <P>Director: Ygor Omar Francisco</P>
        <P>Email: ygor@brics.ninja</P>
      </div>
    </div>
  )
}
