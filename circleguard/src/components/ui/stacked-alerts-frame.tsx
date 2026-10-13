import React from "react";
import { AlertTriangleIcon, CircleCheckIcon } from "lucide-react";

import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/stacked-alerts-frame-utils/alert";
import {
  Frame,
  FramePanel,
} from "@/components/ui/stacked-alerts-frame-utils/frame";
import { Button } from "@/components/ui/button";

function StackedAlertsFrame() {
  return (
    <div className="mx-auto mb-auto w-full max-w-lg">
      <Frame stacked>
        <FramePanel className="p-0!">
          <Alert
            variant="success"
            className="rounded-none border-0 shadow-none"
          >
            <CircleCheckIcon className="size-4" />
            <AlertTitle>Deployment Successful</AlertTitle>
            <AlertDescription>
              Your application has been successfully deployed to the production
              environment.
            </AlertDescription>
          </Alert>
        </FramePanel>
        <FramePanel className="p-0!">
          <Alert
            variant="warning"
            className="rounded-none border-0 shadow-none"
          >
            <AlertTriangleIcon className="size-4 text-yellow-500" />
            <AlertTitle>Resource Limit Reached</AlertTitle>
            <AlertAction>
              <Button size="sm">Verify</Button>
            </AlertAction>
            <AlertDescription>
              Your current plan has reached its resource limits. Consider
              upgrading to a higher tier.
            </AlertDescription>
          </Alert>
        </FramePanel>
      </Frame>
    </div>
  );
}

export default StackedAlertsFrame;
