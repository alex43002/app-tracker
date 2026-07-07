import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import ResetPassword from "./ResetPassword";
import { ApiError } from "../api/client";
import * as authApi from "../api/auth";

vi.mock("../api/auth", () => ({
  requestPasswordReset: vi.fn(),
  confirmPasswordReset: vi.fn(),
}));

const mocked = vi.mocked(authApi);

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/reset-password"]}>
      <Routes>
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/login" element={<div>LOGIN PAGE</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ResetPassword", () => {
  it("requests a reset code and advances to the confirm step", async () => {
    mocked.requestPasswordReset.mockResolvedValueOnce(null);
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByPlaceholderText("Email"), "a@example.com");
    await user.click(screen.getByRole("button", { name: /send reset code/i }));

    expect(mocked.requestPasswordReset).toHaveBeenCalledWith("a@example.com");
    // Neutral, enumeration-safe message + confirm form now visible.
    expect(
      await screen.findByText(/if an account exists/i),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Reset code")).toBeInTheDocument();
  });

  it("confirms the new password and redirects to login", async () => {
    mocked.confirmPasswordReset.mockResolvedValueOnce(null);
    const user = userEvent.setup();
    renderPage();

    // Jump straight to the confirm step.
    await user.click(
      screen.getByRole("button", { name: /already have a code/i }),
    );
    await user.type(screen.getByPlaceholderText("Reset code"), "tok123");
    await user.type(
      screen.getByPlaceholderText(/new password/i),
      "brand-new-pass",
    );
    await user.click(screen.getByRole("button", { name: /set new password/i }));

    expect(mocked.confirmPasswordReset).toHaveBeenCalledWith(
      "tok123",
      "brand-new-pass",
    );
    expect(await screen.findByText("LOGIN PAGE")).toBeInTheDocument();
  });

  it("surfaces an API error on a bad code", async () => {
    mocked.confirmPasswordReset.mockRejectedValueOnce(
      new ApiError(
        { code: "AUTH_TOKEN_INVALID", message: "Token is invalid or expired" },
        400,
      ),
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(
      screen.getByRole("button", { name: /already have a code/i }),
    );
    await user.type(screen.getByPlaceholderText("Reset code"), "bad");
    await user.type(
      screen.getByPlaceholderText(/new password/i),
      "whatever123",
    );
    await user.click(screen.getByRole("button", { name: /set new password/i }));

    expect(
      await screen.findByText(/token is invalid or expired/i),
    ).toBeInTheDocument();
    // Did not navigate away.
    await waitFor(() =>
      expect(screen.queryByText("LOGIN PAGE")).not.toBeInTheDocument(),
    );
  });
});
