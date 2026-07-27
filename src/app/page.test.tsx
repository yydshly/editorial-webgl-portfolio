import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HomePage from "./page";

describe("HomePage", () => {
  it("renders the MVP application shell", () => {
    render(<HomePage />);

    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("id", "site-content");
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Trevor Noah Style Experience",
      }),
    ).toBeInTheDocument();

    expect(screen.getByRole("heading", { level: 2, name: "Manifesto" })).toBeInTheDocument();
    expect(document.getElementById("hero")).toBeInTheDocument();
    expect(document.getElementById("manifesto")).toBeInTheDocument();
    expect(document.getElementById("media")).toBeInTheDocument();
    expect(document.getElementById("about")).toBeInTheDocument();
    expect(document.getElementById("news")).toBeInTheDocument();
    expect(document.getElementById("quote")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Books" })).toBeInTheDocument();
    expect(
      screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent),
    ).toEqual(expect.arrayContaining(["在场的人", "城市之间", "彼此听见"]));

    const quote = document.getElementById("quote");
    const books = document.getElementById("books");

    if (!quote || !books) {
      throw new Error("Expected Quote and Books sections");
    }

    expect(
      quote.compareDocumentPosition(books) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
