export type Plan = 'free' | 'starter' | 'pro'

export const PLANS: Record<Plan, { label: string; monthlyLimit: number; price: number }> = {
  free: {
    label: 'Free',
    monthlyLimit: 10,
    price: 0,
  },
  starter: {
    label: 'Starter',
    monthlyLimit: 100,
    price: 980,
  },
  pro: {
    label: 'Pro',
    monthlyLimit: 500,
    price: 2980,
  },
}

export function getPlanLimit(plan: Plan): number {
  return PLANS[plan].monthlyLimit
}
