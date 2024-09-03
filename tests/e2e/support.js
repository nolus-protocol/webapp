import '@agoric/synpress/support/index';

Cypress.Commands.overwrite("confirmTransaction", (originalFn) => {
    cy.wait(10000);
    return originalFn()
});