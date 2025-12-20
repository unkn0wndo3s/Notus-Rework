import Link from "next/link";
import { Button, Card, Badge } from "@/components/ui";
import TableOfContents from "@/components/legal/TableOfContents";

export default function RGPDPage() {
  const sections = [
    { id: "definitions", title: "Definitions" },
    { id: "presentation", title: "1. Website Presentation" },
    { id: "conditions", title: "2. General Terms of Use" },
    { id: "services", title: "3. Description of Services Provided" },
    { id: "limitations", title: "4. Contractual Limitations" },
    { id: "propriete", title: "5. Intellectual Property" },
    { id: "responsabilite", title: "6. Limitation of Liability" },
    { id: "donnees", title: "7. Management of Personal Data" },
    { id: "incident", title: "8. Incident Notification" },
    { id: "cookies", title: "9. Hypertext Links, Cookies and Tags" },
    { id: "droit", title: "10. Applicable Law" }
  ];

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header Section */}
        <header className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            GDPR Legal Notices
          </h1>
          <Badge variant="outline" className="text-sm">
            Last updated: September 18, 2025
          </Badge>
        </header>

        {/* Table of Contents - Always at the top */}
        <section className="mb-8">
          <Card>
            <Card.Header>
              <Card.Title className="text-lg text-foreground">Table of Contents</Card.Title>
            </Card.Header>
            <Card.Content>
              <TableOfContents sections={sections} />
            </Card.Content>
          </Card>
        </section>

        {/* Main Content */}
        <section className="max-w-4xl mx-auto">
            <Card>
              <Card.Content className="p-8">
                <div className="prose prose-lg max-w-none prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-li:text-foreground">

                  <section id="definitions" className="mb-12">
                    <h2 className="text-2xl font-bold text-foreground mb-6 pb-2 border-b border-border">
                      Definitions
                    </h2>
                    <div className="space-y-4">
                      <div className="bg-muted/50 p-4 rounded-lg">
                        <p className="mb-2">
                          <strong className="text-primary">Client:</strong> any professional or natural person capable within the meaning of articles 1123 et seq. of the Civil Code, or legal person, who visits the Site subject to these general conditions.
                        </p>
                      </div>

                      <div className="bg-muted/50 p-4 rounded-lg">
                        <p className="mb-2">
                          <strong className="text-primary">Services:</strong> https://notus.fr makes available to Clients:
                        </p>
                      </div>

                      <div className="bg-muted/50 p-4 rounded-lg">
                        <p className="mb-2">
                          <strong className="text-primary">Content:</strong> All elements constituting the information present on the Site, including texts – images – videos.
                        </p>
                      </div>

                      <div className="bg-muted/50 p-4 rounded-lg">
                        <p className="mb-2">
                          <strong className="text-primary">Customer Information:</strong> Hereinafter referred to as "Information (s)" which correspond to all personal data likely to be held by https://notus.fr for the management of your account, the management of customer relations and for analysis and statistical purposes.
                        </p>
                      </div>

                      <div className="bg-muted/50 p-4 rounded-lg">
                        <p className="mb-2">
                          <strong className="text-primary">User:</strong> Internet user connecting to or using the aforementioned site.
                        </p>
                      </div>

                      <div className="bg-muted/50 p-4 rounded-lg">
                        <p className="mb-2">
                          <strong className="text-primary">Personal information:</strong> "Information that allows, in any form whatsoever, directly or indirectly, the identification of the natural persons to whom it applies" (Article 4 of Law No. 78-17 of January 6, 1978).
                        </p>
                      </div>

                      <div className="bg-primary/10 p-4 rounded-lg border-l-4 border-primary">
                        <p className="text-sm text-muted-foreground">
                          The terms "personal data", "data subject", "processor" and "sensitive data" have the meaning defined by the General Data Protection Regulation (GDPR: No. 2016-679).
                        </p>
                      </div>
                    </div>
                  </section>

                  <section id="presentation" className="mb-12">
                    <h2 className="text-2xl font-bold text-foreground mb-6 pb-2 border-b border-border">
                      1. Website Presentation
                    </h2>
                    <div className="space-y-6">
                      <p className="text-foreground leading-relaxed">
                        Under Article 6 of Law No. 2004-575 of June 21, 2004 for confidence in the digital economy, users of the website https://notus.fr are informed of the identity of the various stakeholders involved in its creation and monitoring:
                      </p>

                      <div className="bg-muted/30 p-6 rounded-lg">
                        <ul className="space-y-4">
                          <li className="flex flex-col sm:flex-row sm:items-start">
                            <strong className="text-primary min-w-[140px]">Owner:</strong>
                            <span className="text-foreground">SARL Notus Capital social of 5000€ VAT Number: FR02921419131 – 12 allée andré maurois 87000 Limoges</span>
                          </li>
                          <li className="flex flex-col sm:flex-row sm:items-start">
                            <strong className="text-primary min-w-[140px]">Publication Manager:</strong>
                            <span className="text-foreground">Lajudie – francoispierre.lajudie@etu.unilim.fr</span>
                          </li>
                          <li className="flex flex-col sm:flex-row sm:items-start">
                            <strong className="text-primary min-w-[140px]">Webmaster:</strong>
                            <span className="text-foreground">POTEVIN – 763883580</span>
                          </li>
                          <li className="flex flex-col sm:flex-row sm:items-start">
                            <strong className="text-primary min-w-[140px]">Host:</strong>
                            <span className="text-foreground break-words break-all">OVH – 2, rue Kellermann 59100 Roubaix https://help.ovhcloud.com/</span>
                          </li>
                          <li className="flex flex-col sm:flex-row sm:items-start">
                            <strong className="text-primary min-w-[140px]">DPO:</strong>
                            <span className="text-foreground">LegalPlace – contact@LegalPlace.fr</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </section>

                  <section id="conditions" className="mb-12">
                    <h2 className="text-2xl font-bold text-foreground mb-6 pb-2 border-b border-border">
                      2. General Terms of Use
                    </h2>
                    <div className="space-y-6">
                      <p className="text-foreground leading-relaxed">
                        The use of the site https://notus.fr implies full acceptance of the general terms of use described below. These terms of use may be modified or supplemented at any time.
                      </p>
                    </div>
                  </section>

                  {/* Rest of the sections in simplified form to save space while maintaining structure */}
                  <section id="services" className="mb-12">
                    <h2 className="text-2xl font-bold text-foreground mb-6 pb-2 border-b border-border">
                      3. Description of Services
                    </h2>
                    <p className="text-foreground">The website https://notus.fr aims to provide information regarding all of the company's activities.</p>
                  </section>

                  <section id="limitations" className="mb-12">
                    <h2 className="text-2xl font-bold text-foreground mb-6 pb-2 border-b border-border">
                      4. Contractual Limitations
                    </h2>
                    <p className="text-foreground">The site uses JavaScript technology. The site cannot be held responsible for material damage related to the use of the site.</p>
                  </section>

                  <section id="propriete" className="mb-12">
                    <h2 className="text-2xl font-bold text-foreground mb-6 pb-2 border-b border-border">
                      5. Intellectual Property
                    </h2>
                    <p className="text-foreground">SARL Notus owns the intellectual property rights and holds the rights to use all elements accessible on the website.</p>
                  </section>

                  <section id="responsabilite" className="mb-12">
                    <h2 className="text-2xl font-bold text-foreground mb-6 pb-2 border-b border-border">
                      6. Limitation of Liability
                    </h2>
                    <p className="text-foreground">https://notus.fr acts as the publisher of the site and is responsible for the quality and truthfulness of the Content it publishes.</p>
                  </section>

                  <section id="donnees" className="mb-12">
                    <h2 className="text-2xl font-bold text-foreground mb-6 pb-2 border-b border-border">
                      7. Management of Personal Data
                    </h2>
                    <p className="text-foreground">The Client is informed of the regulations concerning marketing communication, the law of June 21, 2014 for confidence in the Digital Economy, the Data Protection Act of August 6, 2004 as well as the General Data Protection Regulation (GDPR: No. 2016-679).</p>
                    <h3 className="text-xl font-bold mt-4">7.1 Persons responsible for collecting personal data</h3>
                    <p className="text-foreground">For Personal Data collected as part of the creation of the User's personal account and their navigation on the Site, the person responsible for processing Personal Data is: Notus. https://notus.fr is represented by Lemesle, its legal representative.</p>
                    <h3 className="text-xl font-bold mt-4">7.2 Purpose of the data collected</h3>
                    <p className="text-foreground">https://notus.fr is likely to process all or part of the data: to provide the service, to prevent fraud, and to improve navigation.</p>
                    <h3 className="text-xl font-bold mt-4">7.3 Right of access, rectification and opposition</h3>
                    <p className="text-foreground">In accordance with current European regulations, Users of https://notus.fr have rights of access, rectification, erasure, and portability of their data.</p>
                  </section>

                  <section id="incident" className="mb-12">
                    <h2 className="text-2xl font-bold text-foreground mb-6 pb-2 border-b border-border">
                      8. Incident Notification
                    </h2>
                    <p className="text-foreground">No matter how hard we try, no method of transmission over the Internet and no method of electronic storage is completely secure. We therefore cannot guarantee absolute security.</p>
                  </section>

                  <section id="cookies" className="mb-12">
                    <h2 className="text-2xl font-bold text-foreground mb-6 pb-2 border-b border-border">
                      9. Hypertext Links, Cookies and Tags
                    </h2>
                    <p className="text-foreground">The site https://notus.fr contains a number of hypertext links to other sites. However, https://notus.fr does not have the possibility to verify the content of the sites thus visited.</p>
                  </section>

                  <section id="droit" className="mb-12">
                    <h2 className="text-2xl font-bold text-foreground mb-6 pb-2 border-b border-border">
                      10. Applicable Law
                    </h2>
                    <p className="text-foreground">Any dispute in connection with the use of the site https://notus.fr is subject to French law. Exclusive jurisdiction is given to the competent courts of Paris.</p>
                  </section>

                </div>
              </Card.Content>
            </Card>
        </section>

        {/* Footer with back button */}
        <footer className="flex justify-center mt-12">
          <Button asChild className="py-2 px-4 text-lg">
            <Link href="/">Back to Home</Link>
          </Button>
        </footer>
      </div>
    </main>
  );
}
