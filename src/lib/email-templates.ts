'use server';

interface RequestDetails {
    id: string;
    department: string;
    total: number;
    submittedBy: string;
}

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: "ZAR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
};

const emailStyles = `
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
        .wrapper { width: 100%; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 20px auto; padding: 20px; background-color: #ffffff; border: 1px solid #ddd; border-radius: 8px; }
        .header { text-align: center; border-bottom: 1px solid #ddd; padding-bottom: 10px; margin-bottom: 20px; }
        .header h2 { color: #007bff; }
        .content { font-size: 16px; }
        .content ul { list-style: none; padding: 0; }
        .content ul li { background-color: #f9f9f9; margin-bottom: 10px; padding: 10px; border-left: 3px solid #007bff; }
        .button-container { text-align: center; margin: 30px 0; }
        .button { display: inline-block; padding: 12px 24px; background-color: #007bff; color: #ffffff !important; text-decoration: none; border-radius: 5px; font-weight: bold; }
        .footer { margin-top: 20px; font-size: 0.8em; color: #777; text-align: center; }
    </style>
`;


export const requestActionRequiredTemplate = (request: RequestDetails, nextStageName: string, link: string): string => {
    const totalFormatted = formatCurrency(request.total);

    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Procurement Request Action Required</title>
            ${emailStyles}
        </head>
        <body>
            <div class="wrapper">
                <div class="container">
                    <div class="header">
                        <h2>Procurement Request Action Required</h2>
                    </div>
                    <div class="content">
                        <p>Hello,</p>
                        <p>A procurement request for the <strong>${request.department}</strong> department requires your attention for the '<strong>${nextStageName}</strong>' stage.</p>
                        
                        <h3>Request Details:</h3>
                        <ul>
                            <li><strong>Request ID:</strong> ${request.id.substring(0,8)}...</li>
                            <li><strong>Submitted By:</strong> ${request.submittedBy}</li>
                            <li><strong>Total Value:</strong> ${totalFormatted}</li>
                        </ul>

                        <p>Please review the request by clicking the button below:</p>
                        <div class="button-container">
                            <a href="${link}" class="button">View Request in ProcureEase</a>
                        </div>
                    </div>
                    <div class="footer">
                        <p>This is an automated notification from the ProcureEase system.</p>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `;
};


export const queryRaisedTemplate = (request: RequestDetails, comment: { actor: string; text: string }, link: string): string => {
    const totalFormatted = formatCurrency(request.total);

    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Query Raised on Procurement Request</title>
            ${emailStyles}
        </head>
        <body>
            <div class="wrapper">
                <div class="container">
                    <div class="header">
                        <h2 style="color: #ffc107;">Query Raised on Procurement Request</h2>
                    </div>
                     <div class="content">
                        <p>Hello,</p>
                        <p>A query has been raised by <strong>${comment.actor}</strong> on your procurement request for the <strong>${request.department}</strong> department.</p>
                        
                        <h3>Query:</h3>
                        <blockquote style="border-left: 4px solid #ccc; padding-left: 15px; margin-left: 0; font-style: italic;">
                          ${comment.text}
                        </blockquote>

                        <h3>Request Details:</h3>
                        <ul>
                            <li><strong>Request ID:</strong> ${request.id.substring(0,8)}...</li>
                            <li><strong>Total Value:</strong> ${totalFormatted}</li>
                        </ul>

                        <p>Your feedback is required. Please respond to the query by clicking the button below:</p>
                        <div class="button-container">
                            <a href="${link}" class="button" style="background-color: #ffc107;">View Request and Respond</a>
                        </div>
                    </div>
                    <div class="footer">
                        <p>This is an automated notification from the ProcureEase system.</p>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `;
};

export const requestRejectedTemplate = (request: RequestDetails, comment: { actor: string; text: string }, link: string): string => {
    const totalFormatted = formatCurrency(request.total);
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Procurement Request Rejected</title>
            ${emailStyles}
        </head>
        <body>
             <div class="wrapper">
                <div class="container">
                    <div class="header">
                        <h2 style="color: #dc3545;">Procurement Request Rejected</h2>
                    </div>
                     <div class="content">
                        <p>Hello,</p>
                        <p>Your procurement request for the <strong>${request.department}</strong> department has been rejected by <strong>${comment.actor}</strong>.</p>
                        
                        <h3>Rejection Reason:</h3>
                        <blockquote style="border-left: 4px solid #ccc; padding-left: 15px; margin-left: 0; font-style: italic;">
                          ${comment.text.replace('REJECTED: ', '')}
                        </blockquote>

                        <h3>Request Details:</h3>
                        <ul>
                            <li><strong>Request ID:</strong> ${request.id.substring(0,8)}...</li>
                            <li><strong>Total Value:</strong> ${totalFormatted}</li>
                        </ul>

                        <p>You can view the rejected request and its full communication history by clicking the button below:</p>
                        <div class="button-container">
                            <a href="${link}" class="button" style="background-color: #6c757d;">View Rejected Request</a>
                        </div>
                    </div>
                    <div class="footer">
                        <p>This is an automated notification from the ProcureEase system.</p>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `;
}
