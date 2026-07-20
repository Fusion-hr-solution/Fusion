## ADDED Requirements

### Requirement: The team progress surface uses product language without explanatory captions

Copy on the manager Team progress surface SHALL convey state and read-only intent through structure and labels, not through explanatory caption sentences. The read-only nature of the workspace SHALL be evident from the absence of write actions rather than stated in prose. Copy SHALL NOT forward-reference capabilities that are not yet built (for example, check-ins). Empty-state guidance that tells the reviewer what must happen next is retained and is not an explanatory caption.

#### Scenario: No explainer captions on the team progress workspace
- **WHEN** the team progress list and participant detail render
- **THEN** no standalone caption sentence merely describes what the workspace shows or that it is read-only

#### Scenario: No forward-reference to unbuilt capabilities
- **WHEN** any team progress copy renders
- **THEN** it does not direct the reviewer to check-ins or other capabilities that are not present in the product

#### Scenario: Empty states still guide the next action
- **WHEN** a reviewer has no locked campaign or no assigned participants
- **THEN** a truthful empty state explains what must happen for participants to appear
