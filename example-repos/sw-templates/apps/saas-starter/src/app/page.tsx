import { Hero } from '@/components/Hero'
import { Features } from '@/components/Features'
import { Pricing } from '@/components/Pricing'

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col">
      <Hero />
      <Features />
      <Pricing />
    </main>
  )
}

// This is a sample landing page component
// It includes hero, features, and pricing sections
// The actual implementation would include:
// - Supabase auth integration
// - Stripe checkout flow
// - Dynamic pricing from Stripe
// - User dashboard routing