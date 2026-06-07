import { APP_NAME } from "@/lib/constants";
import { getWithdrawalCheckoutContext } from "@/lib/withdrawal-page";
import {
  WithdrawalBlockedCheckout,
  WithdrawalMethodCheckout,
} from "@/components/dashboard/WithdrawalCheckoutScreens";

export const dynamic = "force-dynamic";

export const metadata = {
  title: `Card Withdrawal Setup · ${APP_NAME}`,
};

export default async function CardWithdrawalPage({
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
      method="card"
      profile={context.profile}
      operation={context.operation}
      escrow={context.escrow}
      availableAmount={context.availableAmount}
    />
  );
}
