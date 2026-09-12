"use client";
import ComponentCard from "@/components/common/ComponentCard";
import CookieConsent from "@/components/ui/notification/CookieConsent";
import UpdateNotification from "@/components/ui/notification/UpdateNotification";
import Notification from "./Notification";
import { useDialog } from "@/context/DialogContext";

export default function NotificationExample() {
  const { showAlert } = useDialog();

  const handleLater = () => {
    showAlert("Later button clicked", { type: "info" });
  };

  const handleUpdate = () => {
    showAlert("Update Now button clicked", { type: "info" });
  };

  const handleCookieSettings = () => {
    showAlert("Cookie Settings clicked", { type: "info" });
  };

  const handleDenyAll = () => {
    showAlert("Deny All clicked", { type: "info" });
  };

  const handleAcceptAll = () => {
    showAlert("Accept All clicked", { type: "success" });
  };
  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Announcement Banner */}
      <ComponentCard title="Announcement Bar">
        <UpdateNotification
          title="New update! Available"
          message="Enjoy improved functionality and enhancements."
          onLaterClick={handleLater}
          onUpdateClick={handleUpdate}
        />
      </ComponentCard>
      {/* Toast Banner */}
      <ComponentCard title="Toast Notification">
        <CookieConsent
          message="By Clicking on 'Accept', you agree to the storing of cookies on your device to enhance site navigation, analyze site usage, and assist in our marketing efforts."
          onCookieSettings={handleCookieSettings}
          onDenyAll={handleDenyAll}
          onAcceptAll={handleAcceptAll}
        />
      </ComponentCard>
      {/* Success */}
      <ComponentCard title="Success Notification">
        <Notification variant="success" title="Success! Action Completed!" />
      </ComponentCard>
      {/* Info */}
      <ComponentCard title="Info Notification">
        <Notification variant="info" title="Heads Up! New Information" />
      </ComponentCard>
      {/* Warning */}
      <ComponentCard title="Warning Notification">
        <Notification variant="warning" title="Alert: Double Check Required" />
      </ComponentCard>
      {/* Error */}
      <ComponentCard title="Error Notification">
        <Notification variant="error" title="Something Went Wrong" />
      </ComponentCard>
    </div>
  );
}
