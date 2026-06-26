import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import { AnalyticsInsights } from "./AnalyticsInsights";
import * as analyticsApi from "../../api/analytics";

vi.mock("../../api/analytics", () => ({
  fetchFunnel: vi.fn(),
  fetchApplicationsOverTime: vi.fn(),
  fetchTimeToOffer: vi.fn(),
  fetchCompanyFunnels: vi.fn(),
}));

const mocked = vi.mocked(analyticsApi);

function stubAll({
  total = 10,
  points = [{ period: "2026-06", count: 3 }],
  offers = 2,
  companies = [
    { company: "BigCo", applied: 1, interviewing: 1, offer: 1, rejected: 0, total: 3 },
  ],
} = {}) {
  mocked.fetchFunnel.mockResolvedValue({
    applied: 4,
    interviewing: 2,
    offer: 1,
    rejected: 3,
    total,
    responseRate: 0.6,
    interviewRate: 0.3,
    offerRate: 0.1,
  });
  mocked.fetchApplicationsOverTime.mockResolvedValue({
    interval: "month",
    points,
  });
  mocked.fetchTimeToOffer.mockResolvedValue({
    offers,
    averageDays: 15,
    medianDays: 15,
  });
  mocked.fetchCompanyFunnels.mockResolvedValue({ companies });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AnalyticsInsights", () => {
  it("renders the widgets once data resolves", async () => {
    stubAll();
    render(<AnalyticsInsights />);

    // Conversion rates rendered as percentages.
    expect(await screen.findByText("60%")).toBeInTheDocument();
    expect(screen.getByText("30%")).toBeInTheDocument();
    expect(screen.getByText("10%")).toBeInTheDocument();

    // Time-to-offer + company breakdown.
    expect(screen.getByText("Time to offer")).toBeInTheDocument();
    expect(screen.getByText("BigCo")).toBeInTheDocument();

    // One bar per over-time point.
    expect(screen.getAllByTestId("bar")).toHaveLength(1);
  });

  it("shows an empty state when there are no jobs", async () => {
    stubAll({ total: 0, points: [], offers: 0, companies: [] });
    render(<AnalyticsInsights />);

    expect(
      await screen.findByText(/insights will appear once/i),
    ).toBeInTheDocument();
  });

  it("shows an error state when a request fails", async () => {
    mocked.fetchFunnel.mockRejectedValue(new Error("boom"));
    mocked.fetchApplicationsOverTime.mockResolvedValue({ interval: "month", points: [] });
    mocked.fetchTimeToOffer.mockResolvedValue({ offers: 0, averageDays: null, medianDays: null });
    mocked.fetchCompanyFunnels.mockResolvedValue({ companies: [] });

    render(<AnalyticsInsights />);

    await waitFor(() =>
      expect(screen.getByText(/couldn’t load analytics/i)).toBeInTheDocument(),
    );
  });
});
