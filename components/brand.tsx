import { AudioLines } from "lucide-react";
import Link from "next/link";
export function Brand() { return <Link className="brand" href="/"><span className="brand-icon"><AudioLines size={22} /></span>Snap<span>Cue</span></Link>; }
