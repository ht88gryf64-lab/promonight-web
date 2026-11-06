# CFB Venue Coordinate Sanity Report

_Read-only pull for the SpotHero venue list. Coordinates are pipeline-extracted (`humanConfirmed=false` on all 86). Each stored coordinate was reverse-geocoded and cross-checked against the school's true home stadium; every non-OK flag was independently re-verified by a second pass._

## Summary

- **Total CFB venues:** 86
- **Coordinate present:** 78
- **OK (coordinate matches the school's home stadium):** 78
- **Flagged (do NOT send to SpotHero until reviewed):** 8
  - `NO_COORDS`: 8

> Flagged venues remain in `spothero-venues-cfb.csv` marked with their `coord_flag`. They must be eyeballed and corrected before any parking link is minted — a wrong coordinate is a live user-facing error.

## Flagged venues (stored vs. resolved)

| School | Venue | Flag | Stored city/state (raw) | Coord resolves to | School's true home | Dist (mi) | Note |
|---|---|---|---|---|---|---|---|
| Alabama | Saban Field at Bryant–Denny Stadium | `NO_COORDS` |  | (no coordinate stored) | Tuscaloosa, AL |  | stadium coordinate missing from Firestore — must be re-resolved before SpotHero |
| Florida | Ben Hill Griffin Stadium | `NO_COORDS` | 157 Gale Lemerand Drive / Gainesville | (no coordinate stored) | Gainesville, FL |  | stadium coordinate missing from Firestore — must be re-resolved before SpotHero |
| Georgia | Sanford Stadium | `NO_COORDS` | Sanford Dr and Field St / Athens | (no coordinate stored) | Athens, GA |  | stadium coordinate missing from Firestore — must be re-resolved before SpotHero |
| Houston | Space City Financial Stadium | `NO_COORDS` |  | (no coordinate stored) | Houston, TX |  | stadium coordinate missing from Firestore — must be re-resolved before SpotHero |
| James Madison | Bridgeforth Stadium | `NO_COORDS` |  | (no coordinate stored) | Harrisonburg, VA |  | stadium coordinate missing from Firestore — must be re-resolved before SpotHero |
| Nebraska | Memorial Stadium | `NO_COORDS` | \| elevation = | (no coordinate stored) | Lincoln, NE |  | stadium coordinate missing from Firestore — must be re-resolved before SpotHero |
| Northwestern | Martin Stadium | `NO_COORDS` | Evanston / Illinois | (no coordinate stored) | Evanston, IL |  | stadium coordinate missing from Firestore — must be re-resolved before SpotHero |
| Texas | Darrell K Royal–Texas Memorial Stadium | `NO_COORDS` | 405 East 23rd Street Austin / Texas 78712 | (no coordinate stored) | Austin, TX |  | stadium coordinate missing from Firestore — must be re-resolved before SpotHero |

## OK venues (coordinate confirmed at the school's stadium)

78 venues passed. Clean city/state for each is in the CSV. Full per-venue detail:

| School | Venue | Clean city/state | Coord resolves to | Dist (mi) | Verifier |
|---|---|---|---|---|---|
| Air Force | Falcon Stadium | Colorado Springs, CO | U.S. Air Force Academy, CO | 0.1 | high |
| App State | Kidd Brewer Stadium | Boone, NC | Boone, NC | 0.1 | high |
| Arizona | Casino Del Sol Stadium | Tucson, AZ | Tucson, AZ | 0.1 | high |
| Arizona State | Mountain America Stadium | Tempe, AZ | Tempe, AZ | 0.1 | high |
| Arkansas | Donald W. Reynolds Razorback Stadium | Fayetteville, AR | Fayetteville, AR | 0.1 | high |
| Army | Michie Stadium | West Point, NY | West Point, NY | 0.2 | high |
| Auburn | Jordan–Hare Stadium | Auburn, AL | Auburn, AL | 0.15 | high |
| Baylor | McLane Stadium | Waco, TX | Waco, TX | 0.05 | high |
| Boise State | Albertsons Stadium | Boise, ID | Boise, ID | 0.1 | high |
| Boston College | Alumni Stadium | Chestnut Hill, MA | Chestnut Hill, MA | 0 | high |
| BYU | LaVell Edwards Stadium | Provo, UT | Provo, UT | 0.3 | high |
| California | California Memorial Stadium | Berkeley, CA | Berkeley, CA | 0 | high |
| Cincinnati | Nippert Stadium | Cincinnati, OH | Cincinnati, OH | 0.05 | high |
| Clemson | Memorial Stadium | Clemson, SC | Clemson, SC | 0.1 | high |
| Coastal Carolina | Brooks Stadium | Conway, SC | Conway, SC | 0.1 | high |
| Colorado | Folsom Field | Boulder, CO | Boulder, CO | 0.1 | high |
| Duke | Wallace Wade Stadium | Durham, NC | Durham, NC | 0.4 | high |
| Florida State | Doak Campbell Stadium | Tallahassee, FL | Tallahassee, FL | 0.1 | high |
| Fresno State | Valley Children's Stadium | Fresno, CA | Fresno, CA | 0.4 | high |
| Georgia Tech | Bobby Dodd Stadium | Atlanta, GA | Atlanta, GA | 0.1 | high |
| Illinois | Gies Memorial Stadium | Champaign, IL | Champaign, IL | 0.1 | high |
| Indiana | Memorial Stadium | Bloomington, IN | Bloomington, IN | 0 | high |
| Iowa | Kinnick Stadium | Iowa City, IA | Iowa City, IA | 0.1 | high |
| Iowa State | Jack Trice Stadium | Ames, IA | Ames, IA | 0.1 | high |
| Kansas | David Booth Kansas Memorial Stadium | Lawrence, KS | Lawrence, KS | 0.2 | high |
| Kansas State | Bill Snyder Family Football Stadium | Manhattan, KS | Manhattan, KS | 0.1 | high |
| Kentucky | Kroger Field | Lexington, KY | Lexington, KY | 0.3 | high |
| Liberty | Williams Stadium | Lynchburg, VA | Lynchburg, VA | 0.5 | high |
| Louisville | L&N Federal Credit Union Stadium | Louisville, KY | Louisville, KY | 0.3 | high |
| LSU | Tiger Stadium | Baton Rouge, LA | Baton Rouge, LA | 0.1 | high |
| Marshall | Joan C. Edwards Stadium | Huntington, WV | Huntington, WV | 0.5 | high |
| Maryland | SECU Stadium | College Park, MD | College Park, MD | 0.1 | high |
| Memphis | Simmons Bank Liberty Stadium | Memphis, TN | Memphis, TN | 0.2 | high |
| Miami | Hard Rock Stadium | Miami Gardens, FL | Miami Gardens, FL | 0 | high |
| Michigan | Michigan Stadium | Ann Arbor, MI | Ann Arbor, MI | 0 | high |
| Michigan State | Spartan Stadium | East Lansing, MI | East Lansing, MI | 0.1 | high |
| Minnesota | Huntington Bank Stadium | Minneapolis, MN | Minneapolis, MN | 0.1 | high |
| Mississippi State | Davis Wade Stadium | Starkville, MS | Starkville, MS | 0.05 | high |
| Missouri | Faurot Field | Columbia, MO | Columbia, MO | 0.1 | high |
| Navy | Navy–Marine Corps Memorial Stadium | Annapolis, MD | Annapolis, MD | 2.5 | high |
| NC State | Carter–Finley Stadium | Raleigh, NC | Raleigh, NC | 0.05 | high |
| North Carolina | Kenan Stadium | Chapel Hill, NC | Chapel Hill, NC | 0.1 | high |
| Northern Illinois | Huskie Stadium | DeKalb, IL | DeKalb, IL | 0.1 | high |
| Notre Dame | Notre Dame Stadium | Notre Dame, IN | South Bend, IN | 0.05 | high |
| Ohio State | Ohio Stadium | Columbus, OH | Columbus, OH | 0 | high |
| Oklahoma | Gaylord Family Oklahoma Memorial Stadium | Norman, OK | Norman, OK | 0.1 | high |
| Oklahoma State | Boone Pickens Stadium | Stillwater, OK | Stillwater, OK | 0 | high |
| Ole Miss | Vaught–Hemingway Stadium | Oxford, MS | Oxford, MS | 0.3 | high |
| Oregon | Autzen Stadium | Eugene, OR | Eugene, OR | 0.1 | high |
| Penn State | Beaver Stadium | University Park, PA | University Park, PA | 0.1 | high |
| Pittsburgh | Acrisure Stadium | Pittsburgh, PA | Pittsburgh, PA | 0.05 | high |
| Purdue | Ross–Ade Stadium | West Lafayette, IN | West Lafayette, IN | 0 | high |
| Rutgers | SHI Stadium | Piscataway, NJ | Piscataway, NJ | 0 | high |
| San Diego State | Snapdragon Stadium | San Diego, CA | San Diego, CA | 0.3 | high |
| SMU | Gerald J. Ford Stadium | Dallas, TX | University Park, TX | 0.1 | high |
| South Carolina | Williams–Brice Stadium | Columbia, SC | Columbia, SC | 0.1 | high |
| Stanford | Stanford Stadium | Stanford, CA | Stanford, CA | 0.1 | high |
| Syracuse | JMA Wireless Dome | Syracuse, NY | Syracuse, NY | 0.1 | high |
| TCU | Amon G. Carter Stadium | Fort Worth, TX | Fort Worth, TX | 0.05 | high |
| Tennessee | Neyland Stadium | Knoxville, TN | Knoxville, TN | 0.1 | high |
| Texas A&M | Kyle Field | College Station, TX | College Station, TX | 0 | high |
| Texas Tech | Jones Stadium | Lubbock, TX | Lubbock, TX | 0.1 | high |
| Toledo | Glass Bowl | Toledo, OH | Toledo, OH | 0.5 | high |
| Tulane | Yulman Stadium | New Orleans, LA | New Orleans, LA | 0.3 | high |
| UCF | Acrisure Bounce House | Orlando, FL | Orlando, FL | 0.05 | high |
| UCLA | Rose Bowl | Pasadena, CA | Pasadena, CA | 0.05 | high |
| UConn | Pratt & Whitney Stadium at Rentschler Field | East Hartford, CT | Hartford, CT | 1.7 | high |
| UNLV | Allegiant Stadium | Las Vegas, NV | Paradise, NV | 0 | high |
| USC | Los Angeles Memorial Coliseum | Los Angeles, CA | Los Angeles, CA | 0.05 | high |
| USF | Raymond James Stadium | Tampa, FL | Tampa, FL | 0 | high |
| Utah | Rice–Eccles Stadium | Salt Lake City, UT | Salt Lake City, UT | 0.1 | high |
| Vanderbilt | FirstBank Stadium | Nashville, TN | Nashville, TN | 0 | high |
| Virginia | Scott Stadium | Charlottesville, VA | Charlottesville, VA | 0.1 | high |
| Virginia Tech | Lane Stadium | Blacksburg, VA | Blacksburg, VA | 0.05 | high |
| Wake Forest | Allegacy Federal Credit Union Stadium | Winston-Salem, NC | Winston-Salem, NC | 0.6 | high |
| Washington | Husky Stadium | Seattle, WA | Seattle, WA | 0 | high |
| West Virginia | Milan Puskar Stadium | Morgantown, WV | Morgantown, WV | 0.2 | high |
| Wisconsin | Camp Randall Stadium | Madison, WI | Madison, WI | 0.1 | high |

