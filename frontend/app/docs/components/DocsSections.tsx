'use client';

import React from 'react';
import { DocSection } from './DocsSidebar';
import { Copy, ExternalLink, Terminal, ShieldCheck, Target, HelpCircle } from 'lucide-react';

interface SectionProps {
  section: DocSection;
}

const CodeBlock: React.FC<{ code: string; language?: string }> = ({ code, language }) => (
  <div className="relative group my-6">
    <div className="absolute -top-3 left-4 px-2 py-0.5 bg-[#0a2a2a] text-[0.6rem] text-cyan-500 font-mono border border-cyan-500/20 rounded uppercase tracking-widest">
      {language || 'bash'}
    </div>
    <div className="p-6 pt-8 rounded-xl bg-[#030f0f] border border-white/5 font-mono text-sm overflow-x-auto text-[rgba(255,255,255,0.8)]">
      <pre><code>{code}</code></pre>
    </div>
<button className="absolute top-4 right-4 p-2 rounded-lg bg-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-all opacity-0 group-hover:opacity-100" aria-label="Copy code to clipboard">
       <Copy size={16} />
     </button>
  </div>
);

const DocsSections: React.FC<SectionProps> = ({ section }) => {
  switch (section) {
    case 'getting-started':
      return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h1 className="text-4xl font-extrabold text-white mb-6 tracking-tight">Getting Started</h1>
          <p className="text-lg text-[rgba(180,210,210,0.7)] leading-relaxed mb-8">
            Welcome to Nestera, the premier decentralized savings platform on Stellar. Our mission is to provide 
            secure, transparent, and high-yield savings opportunities to everyone, regardless of their location or financial background.
          </p>
          
          <h2 className="text-2xl font-bold text-white mb-4 mt-12">Core Concepts</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-8">
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 mb-4">
                <ShieldCheck size={20} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">On-Chain Safety</h3>
              <p className="text-sm text-[rgba(180,210,210,0.6)]">All funds are held in Soroban smart contracts, audited and verifiable on-chain.</p>
            </div>
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-4">
                <Target size={20} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Goal-Oriented</h3>
              <p className="text-sm text-[rgba(180,210,210,0.6)]">Create specific savings goals with automated yield optimization to reach them faster.</p>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-white mb-4">Quick Start</h2>
          <ol className="list-decimal list-inside space-y-4 text-[rgba(180,210,210,0.7)] ml-2">
            <li>Connect your Stellar wallet (Freighter, Albedo, or xBull).</li>
            <li>Select a savings product or create a custom goal.</li>
            <li>Deposit stablecoins (USDC/USDT) to start earning yield.</li>
            <li>Monitor your growth through the personalized dashboard.</li>
          </ol>
        </div>
      );

    case 'connect-wallet':
      return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h1 className="text-4xl font-extrabold text-white mb-6 tracking-tight">Connect Wallet</h1>
          <p className="text-lg text-[rgba(180,210,210,0.7)] leading-relaxed mb-8">
            To interact with Nestera, you need a Stellar wallet that supports Soroban smart contracts. 
            We recommend using **Freighter** for the best experience.
          </p>

          <div className="p-8 rounded-3xl bg-gradient-to-br from-cyan-500/5 to-transparent border border-cyan-500/20 mb-12">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Terminal size={20} className="text-cyan-400" />
              Setup Guide
            </h3>
            <ul className="space-y-4 text-[rgba(180,210,210,0.8)]">
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">1</span>
                <span>Install the <a href="https://www.freighter.app/" target="_blank" className="text-cyan-400 underline">Freighter extension</a> for your browser.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">2</span>
                <span>Create a new account or import an existing recovery phrase.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">3</span>
                <span>Ensure you are on the **Public Network** or **Testnet** (depending on your environment).</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">4</span>
                <span>Click the "Connect Wallet" button in the Nestera navigation bar.</span>
              </li>
            </ul>
          </div>
        </div>
      );

    case 'savings-goals':
      return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h1 className="text-4xl font-extrabold text-white mb-6 tracking-tight">Creating Savings Goals</h1>
          <p className="text-lg text-[rgba(180,210,210,0.7)] leading-relaxed mb-8">
            Custom goals allow you to save for specific targets—like a new home, travel, or retirement—while 
            leveraging the power of automated DeFi yields.
          </p>

          <h2 className="text-2xl font-bold text-white mb-4">Step-by-Step Tutorial</h2>
          <div className="space-y-8 my-8">
            <div className="flex gap-6">
              <div className="text-4xl font-black text-white/10 select-none">01</div>
              <div>
                <h4 className="text-white font-bold mb-2">Define Your Target</h4>
                <p className="text-[rgba(180,210,210,0.6)]">Set a name, target amount, and deadline for your goal. This helps our algorithm optimize your yield strategy.</p>
              </div>
            </div>
            <div className="flex gap-6">
              <div className="text-4xl font-black text-white/10 select-none">02</div>
              <div>
                <h4 className="text-white font-bold mb-2">Choose Your Asset</h4>
                <p className="text-[rgba(180,210,210,0.6)]">Select which stablecoin you want to save in. Most users prefer USDC for its stability and liquidity on Stellar.</p>
              </div>
            </div>
            <div className="flex gap-6">
              <div className="text-4xl font-black text-white/10 select-none">03</div>
              <div>
                <h4 className="text-white font-bold mb-2">Automate Deposits</h4>
                <p className="text-[rgba(180,210,210,0.6)]">Set up recurring deposits or make one-time contributions whenever you have spare capital.</p>
              </div>
            </div>
          </div>
        </div>
      );

    case 'api-docs':
      return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h1 className="text-4xl font-extrabold text-white mb-6 tracking-tight">API Documentation</h1>
          <p className="text-lg text-[rgba(180,210,210,0.7)] leading-relaxed mb-8">
            Developers can integrate Nestera's saving features into their own applications using our REST API or by interacting directly with our smart contracts.
          </p>

          <h2 className="text-2xl font-bold text-white mb-4">Getting Pool Data</h2>
          <p className="text-[rgba(180,210,210,0.7)] mb-4">Fetch the current APY and TVL for any savings pool.</p>
          <CodeBlock 
            language="javascript"
            code={`// Fetch pool details
const response = await fetch('https://api.nestera.io/v1/pools/usdc-main');
const data = await response.json();

console.log(\`Current APY: \${data.apy}%\`);`}
          />

          <h2 className="text-2xl font-bold text-white mb-4 mt-12">User Balance API</h2>
          <p className="text-[rgba(180,210,210,0.7)] mb-4">Retrieve a user's total savings across all goals.</p>
          <CodeBlock 
            language="bash"
            code={`curl -X GET "https://api.nestera.io/v1/user/GABC...1234/balance" \\
     -H "Authorization: Bearer YOUR_API_KEY"`}
          />
        </div>
      );

    case 'smart-contracts':
      return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h1 className="text-4xl font-extrabold text-white mb-6 tracking-tight">Smart Contracts</h1>
          <p className="text-lg text-[rgba(180,210,210,0.7)] leading-relaxed mb-8">
            Nestera is powered by a suite of Soroban smart contracts on the Stellar network. 
            All contracts are open-source and verified.
          </p>

          <div className="flex flex-col gap-4 my-8">
            {[
              { name: 'Core Vault', id: 'CCV...8XY', desc: 'Main logic for fund management and yield distribution.' },
              { name: 'Goal Factory', id: 'CGF...9ZZ', desc: 'Handles creation and tracking of custom savings goals.' },
              { name: 'Yield Oracle', id: 'CYO...4AA', desc: 'Provides real-time yield data from supported DeFi protocols.' },
            ].map((contract) => (
              <div key={contract.id} className="p-6 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between gap-6 group hover:border-cyan-500/30 transition-all">
                <div>
                  <h4 className="text-white font-bold mb-1">{contract.name}</h4>
                  <p className="text-sm text-[rgba(180,210,210,0.6)]">{contract.desc}</p>
                </div>
                <div className="flex items-center gap-3">
                  <code className="text-xs font-mono text-cyan-400 bg-cyan-400/10 px-2 py-1 rounded">{contract.id}</code>
                  <a href="#" className="text-white/40 hover:text-cyan-400 transition-colors">
                    <ExternalLink size={18} />
                  </a>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-4">
            <ShieldCheck className="text-emerald-400 shrink-0" size={24} />
            <div>
              <h4 className="text-emerald-400 font-bold mb-1">Audit Status</h4>
              <p className="text-sm text-[rgba(180,210,210,0.8)]">
                Our smart contracts have been audited by **CyberGuard** and **StellarSecurity**. No critical vulnerabilities were found.
              </p>
            </div>
          </div>
        </div>
      );

    case 'faq':
      return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h1 className="text-4xl font-extrabold text-white mb-6 tracking-tight">Documentation FAQ</h1>
          <p className="text-lg text-[rgba(180,210,210,0.7)] leading-relaxed mb-8">
            Common technical questions and troubleshooting steps for users and developers.
          </p>

          <div className="space-y-6">
            {[
              { q: 'Is there a minimum deposit amount?', a: 'No, Nestera has no minimum deposit. You can start saving with as little as 1 XLM worth of stablecoins.' },
              { q: 'What happens if a DeFi protocol Nestera uses fails?', a: 'Nestera uses multiple protocols to diversify risk. In the event of a protocol failure, our emergency pause mechanism protects remaining funds.' },
              { q: 'How often are yields compounded?', a: 'Yields are compounded automatically every ledger close (approximately every 5 seconds).' },
              { q: 'Are there any withdrawal fees?', a: 'Nestera charges a small 0.1% performance fee on the yield earned, but there are no flat withdrawal fees.' },
            ].map((item, i) => (
              <div key={i} className="p-6 rounded-2xl bg-white/5 border border-white/10">
                <h4 className="text-white font-bold mb-3 flex items-center gap-2">
                  <HelpCircle size={18} className="text-cyan-400" />
                  {item.q}
                </h4>
                <p className="text-[rgba(180,210,210,0.7)] leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      );

    default:
      return null;
  }
};

export default DocsSections;
