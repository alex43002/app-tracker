import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import VerifyEmail from "./VerifyEmail";
import { ApiError } from "../api/client";
import * as authApi from "../api/auth";

vi.mock("../api/auth", () => ({
  confirmEmailVerification: vi.fn(),
  requestEmailVerification: vi.fn(),
}));

const mocked = vi.mocked(authApi);

function renderPage() {
  return render(
    <MemoryRouter>
      <VerifyEmail />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("VerifyEmail", () => {
  it("confirms a token and shows the verified state", async () => {
    mocked.confirmEmailVerification.mockResolvedValueOnce(null);
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByPlaceholderText("Verification code"), "vtok");
    await user.click(screen.getByRole("button", { name: /verify email/i }));

    expect(mocked.confirmEmailVerification).toHaveBeenCalledWith("vtok");
    expect(
      await screen.findByText(/your email is verified/i),
    ).toBeInTheDocument();
  });

  it("resends a code with a neutral message", async () => {
    mocked.requestEmailVerification.mockResolvedValueOnce(null);
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByPlaceholderText("Email"), "a@example.com");
    await user.click(
      screen.getByRole("button", { name: /resend verification code/i }),
    );

    expect(mocked.requestEmailVerification).toHaveBeenCalledWith(
      "a@example.com",
    );
    expect(
      await screen.findByText(/if an account exists/i),
    ).toBeInTheDocument();
  });

  it("surfaces an API error on a bad code", async () => {
    mocked.confirmEmailVerification.mockRejectedValueOnce(
      new ApiError(
        {
          code: "AUTH_TOKEN_INVALID",
          message: "Verification token is invalid",
        },
        400,
      ),
    );
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByPlaceholderText("Verification code"), "bad");
    await user.click(screen.getByRole("button", { name: /verify email/i }));

    expect(
      await screen.findByText(/verification token is invalid/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/your email is verified/i),
    ).not.toBeInTheDocument();
  });
});
