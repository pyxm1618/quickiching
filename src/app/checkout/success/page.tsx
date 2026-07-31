import { redirect } from "next/navigation";
import { CheckoutStatus } from "@/components/checkout-status";
import { getCurrentUser } from "@/lib/auth/session";

const ORDER_ID_PATTERN = /^ord_[A-Za-z0-9_-]{8,128}$/;

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string | string[] }>;
}) {
  const user = await getCurrentUser();
  const params = await searchParams;
  const orderId = typeof params.orderId === "string" ? params.orderId : "";
  if (!user) {
    const callback = orderId
      ? `/checkout/success?orderId=${encodeURIComponent(orderId)}`
      : "/checkout/success";
    redirect(`/signin?callbackURL=${encodeURIComponent(callback)}`);
  }

  if (!ORDER_ID_PATTERN.test(orderId)) {
    redirect("/account?order=not-found");
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-16">
      <CheckoutStatus orderId={orderId} />
    </main>
  );
}
