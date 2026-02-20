
// Reusable component to display when a list/search has no results.
// Used to satisfy the user story:
// "As a user, I want to see an error message if my search returns no results."
export default function NoResultsMessage({
  title = "No results",
  message = "No items matched your search. Please try something else .",
}) {
  return (
    <div style={{ border: "1px dashed #bbb", padding: 16, borderRadius: 8 }}>
      <h3 style={{ margin: 0 }}>{title}</h3>
      <p style={{ margin: "8px 0 0 0" }}>{message}</p>
    </div>
  );
}