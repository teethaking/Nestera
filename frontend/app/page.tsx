import { Metadata } from "next";
import LandingPage from './LandingPage/LandingPage';

export const metadata: Metadata = {
  title: "Nestera - Decentralized Savings on Stellar",
  description: "Experience the future of decentralized savings on Stellar. Nestera provides secure, transparent, and automated goal-based savings powered by Soroban smart contracts.",
};

export default function Home() {

  return <LandingPage />;
}