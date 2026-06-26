import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { EmailVerificationBanner } from "./EmailVerificationBanner";

describe("EmailVerificationBanner", () => {
  it("renders a prompt with a link to the verify page", () => {
    render(
      <MemoryRouter>
        <EmailVerificationBanner />
      </MemoryRouter>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(/isn’t verified/i);
    expect(screen.getByRole("link", { name: /verify email/i })).toHaveAttribute(
      "href",
      "/verify-email",
    );
  });
});
