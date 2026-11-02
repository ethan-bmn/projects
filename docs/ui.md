# Application navigation

The main header links to Clients, Prospects, and Settings. The Clients link
remains active while viewing a client or project. Theme and sign-out controls
remain available at every screen size.

## Settings

| Page | Purpose |
| --- | --- |
| `/settings` | Connection status and links to each configuration page |
| `/settings/abby` | Abby API key |
| `/settings/email` | SMTP connection and sender identity |
| `/settings/templates` | Quote email subject and body |
| `/settings/signature` | Documenso API key and signing workspace |
| `/settings/account` | Owner email and password |

Desktop navigation sits beside the form. On mobile, a section selector replaces
the side navigation. Legacy settings bookmarks using `#abby`, `#email`,
`#documenso`, or `#account` redirect to their new pages on initial load.
Leaving a form with unsaved changes requests confirmation. Saved passwords and
tokens retain their existing blank-input behavior and are never displayed.

## Projects

Every project has the same breadcrumbs and local navigation:

- The overview links to the project's documents and shows client details.
- `/quote` contains the Abby quote, email preview, signing options, and delivery
  history. Association can be edited here without leaving the workflow.
- `/specification` contains the specification and export actions. The editor
  groups fields into Cadrage, Besoins et contraintes, Conception technique, and
  Livraison et planning. Saving reveals and focuses any missing required field,
  including fields in another section. All sections are saved together.
  The reading view omits empty optional sections while retaining saved diagrams.
- `/edit` changes the project's name and quote association.

Prospects use a table on desktop and stacked contact rows on mobile, with the
same edit and delete actions in both layouts.

## Manual verification

The UI was reviewed in headless Chrome using synthetic API fixtures, separate
from the real backend and authentication. Desktop (1440 px) and mobile (390 px)
routes were checked in light and dark themes. Additional mobile checks at 320 px
covered settings, project overview, quote, project editing, and prospects.
Checks covered settings navigation, template saves, unsaved-change confirmation,
grouped specification validation/save, quote preview, and mobile prospect editing.
No customer emails or signing requests were sent. This review does not verify
live database writes, SMTP delivery, Documenso, or PDF exports.
