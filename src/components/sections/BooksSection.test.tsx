import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { getSectionByKind } from "@/content";

import BooksSection from "./BooksSection";

afterEach(() => {
  cleanup();
});

function renderBooksSection() {
  const section = getSectionByKind("books");

  if (!section) {
    throw new Error("Expected Books content");
  }

  render(<BooksSection section={section} />);
}

describe("BooksSection", () => {
  it("renders the three-book FIELD NOTES archive as complete semantic DOM", () => {
    renderBooksSection();

    const section = screen.getByRole("region", { name: "Books" });
    const figure = within(section).getByRole("figure", {
      name: /FIELD NOTES.*在场档案/,
    });
    const articles = within(section).getAllByRole("article");
    const images = within(figure).getAllByRole("img");

    expect(articles).toHaveLength(3);
    expect(images).toHaveLength(3);
    expect(figure).toHaveAttribute(
      "aria-labelledby",
      "books-series-label",
    );
    expect(within(section).getByText("DEV-HOST-01")).toBeInTheDocument();
    expect(within(section).getByText("FIELD NOTES")).toBeInTheDocument();
    expect(within(section).getByText("在场档案")).toBeInTheDocument();
    expect(within(section).getByText("development asset study")).toBeInTheDocument();

    expect(
      articles.map((article) => within(article).getByRole("heading", { level: 3 }).textContent),
    ).toEqual(["在场的人", "城市之间", "彼此听见"]);
    expect(
      articles.map((article) => within(article).getByText(/People in the Room|Between the Cities|Hearing One Another/).textContent),
    ).toEqual(["People in the Room", "Between the Cities", "Hearing One Another"]);

    for (const article of articles) {
      expect(within(article).getByText("Key fact")).toBeInTheDocument();
      expect(within(article).getByRole("button", {
        name: "Publication details in development",
      })).toBeDisabled();
      expect(within(article).queryByRole("link")).not.toBeInTheDocument();
    }

    expect(figure.compareDocumentPosition(articles[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("keeps complete cover alternatives available when WebGL is unavailable", () => {
    renderBooksSection();

    const figure = screen.getByRole("figure", {
      name: /FIELD NOTES.*在场档案/,
    });
    const images = within(figure).getAllByRole("img");

    expect(figure).toHaveAttribute("data-books-fallback-state", "unavailable");
    expect(images.map((image) => image.getAttribute("data-book-id"))).toEqual([
      "people-in-the-room",
      "between-the-cities",
      "hearing-one-another",
    ]);
    expect(images.map((image) => image.getAttribute("alt"))).toEqual([
      "Development cover for 在场的人 (People in the Room) by DEV-HOST-01",
      "Development cover for 城市之间 (Between the Cities) by DEV-HOST-01",
      "Development cover for 彼此听见 (Hearing One Another) by DEV-HOST-01",
    ]);
    expect(images.every((image) => image.dataset.booksFallback === "true")).toBe(
      true,
    );
  });

  it("renders all metadata, topics, and facts from content rather than duplicating copy", () => {
    renderBooksSection();

    expect(screen.getByText("2022")).toBeInTheDocument();
    expect(screen.getByText("2024")).toBeInTheDocument();
    expect(screen.getByText("2026")).toBeInTheDocument();
    expect(screen.getByText("Interview essays")).toBeInTheDocument();
    expect(screen.getByText("City essays")).toBeInTheDocument();
    expect(screen.getByText("Conversation essays")).toBeInTheDocument();
    expect(screen.getByText("人物访谈")).toBeInTheDocument();
    expect(screen.getByText("迁移")).toBeInTheDocument();
    expect(screen.getByText("跨文化沟通")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Built from sustained interview notes rather than retrospective biography.",
      ),
    ).toBeInTheDocument();
  });
});
