import { APP_NAME } from "@/lib/constants";
import { getWithdrawalCheckoutContext } from "@/lib/withdrawal-page";
import {
  WithdrawalBlockedCheckout,
  WithdrawalMethodCheckout,
} from "@/components/dashboard/WithdrawalCheckoutScreens";

export const dynamic = "force-dynamic";

export const metadata = {
  title: `PayPal Checkout · ${APP_NAME}`,
};

export default async function PaypalWithdrawalPage({
  searchParams,
}: {
  searchParams?: { caseId?: string };
}) {
  const context = await getWithdrawalCheckoutContext(searchParams?.caseId);
  if ("blocked" in context) {
    return <WithdrawalBlockedCheckout {...context} />;
  }

  return (
    <WithdrawalMethodCheckout
      method="paypal"
      profile={context.profile}
      operation={context.operation}
      escrow={context.escrow}
      availableAmount={context.availableAmount}
    />
  );
}
