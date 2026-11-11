# The idea, in plain English

TSS has had recurring technical issues. UC San Diego has documented known limitations and service disruptions, including a TSS outage reported on November 10, 2026. When pages fail along the way, reaching the actual booking step becomes a problem of its own. See [UCSD's service updates](https://status.ucsd.edu/) for the current situation.

With some digging, we found what the real Book button needs:

1. A valid TSS sign-in.
2. The exact class and section details.
3. A registration check, including any warning the user must review.
4. The request that saves the enrollment.
5. A check of whether the enrollment was actually recorded.

This site starts by asking you to sign in to TSS. You complete UCSD and Duo in an isolated browser hosted for your session. Once TSS recognizes that session, clicking **Book** asks it to check and submit your selected option directly, without walking through the catalog and booking-page screens again.

<details>
<summary>Where does the token go?</summary>

TSS uses session cookies to recognize the signed-in browser and an anti-forgery token to protect requests. Both stay inside the isolated hosted browser. Its authenticated requests use them when talking to TSS. They are not handed to the webpage or baked into its Book button.

The website has its own separate request-protection token for its API. That is not the TSS token and cannot, by itself, enroll someone.

</details>

Profiles and classes are added manually. The host or their agent adds display names, requested courses, and the available section combinations. Each exact option is inspected and compared with the native booking behavior before its button is enabled. The starter shows **King Triton, Person 2, and Person 3**; hosts replace these with their own approved aliases and course plans.

<details>
<summary>Why validate each course option?</summary>

A course code is not enough. The request must identify the correct module, package, academic year, term, and linked meetings. A read-only comparison checks that the adapter prepares the same request as TSS for that exact option. It does not enroll or drop anything. New or changed options need new validation.

</details>

Selecting a profile never signs you into that person's account. Each visitor signs in separately, and Book always uses the account authenticated in that visitor's session. A display profile is simply a way to organize course lists; it is not an access-control list.

<details>
<summary>What happens after clicking Book?</summary>

The adapter reads current course context and sends `CheckRegistration`. If TSS returns a warning, the user must explicitly review it. The adapter then sends one `SaveChanges` request. Follow-up reads distinguish booked, waitlisted, and unconfirmed outcomes. An accepted request is not automatically treated as confirmed enrollment.

</details>

The goal is fewer navigation steps and clearer results. TSS still has to accept the enrollment. If its booking service is unavailable, this site cannot make that service work. If a response disappears after submission, the site does not repeatedly send Book: the request might already have succeeded.

Hosts can use an agent to build their own instance from this repository, add their own profiles and courses, and perform the read-only checks. The [agent setup guide](AGENT_SETUP.md) explains the steps and where human participation is needed.
